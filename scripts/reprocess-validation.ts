/**
 * Reprocessamento offline dos dados do modo de validação.
 *
 * O QUE ISSO FAZ: lê o arquivo JSON de pontos brutos (exportado pelo botão
 * "Baixar tudo (CSV + JSON)" na tela de resultado, no modo de validação —
 * ver lib/validation/rawFrameDb.ts) e, para cada repetição válida, RECALCULA
 * o ângulo com cada versão do algoritmo abaixo (PIPELINES), comparando
 * sempre com o valor de referência (goniômetro/inclinômetro). No final,
 * imprime um resumo por região + movimento: erro médio, maior erro e
 * correlação com a referência.
 *
 * Isso deixa testar uma melhoria nova (ex.: o próximo passo do plano) nos
 * MESMOS voluntários já medidos, sem precisar chamar ninguém de volta —
 * só é preciso ter o arquivo de pontos brutos daquela coleta.
 *
 * IMPORTANTE — limitação de quando os dados foram coletados: a gravação de
 * pontos brutos só existe a partir deste commit. Um CSV de uma coleta
 * anterior a isso (ex.: a primeira rodada de linha de base) não tem um
 * arquivo de pontos brutos correspondente — não dá pra reprocessar essas
 * linhas, só as coletadas de agora em diante com um link que já inclua essa
 * gravação.
 *
 * COMO RODAR (peça para o Claude Code rodar, indicando o caminho do
 * arquivo JSON baixado):
 *
 *   npm run reprocess -- caminho/para/uort-validacao-pontos-brutos-2026-09-28.json
 *
 * Opcionalmente, um segundo caminho aponta para o CSV da mesma coleta —
 * quando informado, o script confere se o valor recalculado pela versão
 * do algoritmo que gerou aquela linha bate com o que o CSV já registrou
 * (um autoteste: se não bater, é sinal de erro neste script, não no app).
 *
 *   npm run reprocess -- pontos-brutos.json uort-validacao.csv
 */

import { readFileSync } from "node:fs";
import { calculateShoulderFlexionAngle, calculateAbductionAngle } from "@/lib/angles";
import { setFrameAspect } from "@/lib/geometry";
import { calculateKneeAngle, kneeFlexionFromRawAngle } from "@/modules/knee/angles";
import { MovementStateMachine } from "@/lib/movementDetection";
import { MovingAverage, LandmarksSmoother } from "@/lib/smoothing";
import { APP_CONFIG } from "@/config/app";
import { KNEE_CONFIG } from "@/config/modules/knee";
import { PRECISION_CONFIG } from "@/config/precision";
import { FrameLandmarks } from "@/lib/types";
import { RawFrameRecord } from "@/lib/validation/types";

// ---------------------------------------------------------------------
// Lógica de cada região/movimento — espelha exatamente o que roda ao vivo
// em components/CameraFlow.tsx (ombro) e
// modules/knee/components/KneeCameraFlow.tsx (joelho). Se aquele código
// mudar, este bloco precisa ser atualizado junto.
// ---------------------------------------------------------------------

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function shoulderRawAngle(test: string, landmarks: FrameLandmarks, side: string): number {
  const shoulder = side === "right" ? landmarks.rightShoulder : landmarks.leftShoulder;
  const elbow = side === "right" ? landmarks.rightElbow : landmarks.leftElbow;
  const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
  return test === "flexion"
    ? calculateShoulderFlexionAngle(shoulder, elbow, hip)
    : calculateAbductionAngle(shoulder, elbow, hip);
}

function shoulderNeutral(calibration: Record<string, unknown>, side: string): number {
  return side === "right" ? num(calibration.neutralArmAngleRight) : num(calibration.neutralArmAngleLeft);
}

/** Mirrors pickVisibleSide em modules/knee/components/KneeCameraFlow.tsx. */
function pickVisibleSide(landmarks: FrameLandmarks): "right" | "left" {
  const rightVis = landmarks.rightKnee.visibility ?? 1;
  const leftVis = landmarks.leftKnee.visibility ?? 1;
  return rightVis >= leftVis ? "right" : "left";
}

function kneeRawSignal(
  test: string,
  side: string,
  landmarks: FrameLandmarks,
  calibration: Record<string, unknown>
): number {
  const rightRaw = calculateKneeAngle(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle);
  const leftRaw = calculateKneeAngle(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle);
  const trackedSide = side === "both" ? pickVisibleSide(landmarks) : side;

  if (test === "flexion") {
    return kneeFlexionFromRawAngle(trackedSide === "right" ? rightRaw : leftRaw);
  }
  if (test === "squat") {
    return (kneeFlexionFromRawAngle(rightRaw) + kneeFlexionFromRawAngle(leftRaw)) / 2;
  }
  // sitToStand
  const neutralSeated = kneeFlexionFromRawAngle(
    trackedSide === "right" ? num(calibration.neutralKneeAngleRight) : num(calibration.neutralKneeAngleLeft)
  );
  const currentFlexion = kneeFlexionFromRawAngle(trackedSide === "right" ? rightRaw : leftRaw);
  return Math.max(0, neutralSeated - currentFlexion);
}

/** Mirrors neutralSignal() em modules/knee/components/KneeCameraFlow.tsx — o valor usado em machine.arm(). */
function kneeNeutralSignal(test: string, side: string, calibration: Record<string, unknown>): number {
  if (test === "flexion") {
    const raw = side === "right" ? num(calibration.neutralKneeAngleRight) : num(calibration.neutralKneeAngleLeft);
    return kneeFlexionFromRawAngle(raw);
  }
  if (test === "squat") {
    return (
      (kneeFlexionFromRawAngle(num(calibration.neutralKneeAngleRight)) +
        kneeFlexionFromRawAngle(num(calibration.neutralKneeAngleLeft))) /
      2
    );
  }
  return 0; // sitToStand: o próprio rawSignal já é "quanto abaixo do neutro sentado", começa em ~0
}

// ---------------------------------------------------------------------
// Pipelines: cada versão do algoritmo, como uma função "sequência de
// quadros -> valor medido". Adicione uma nova entrada aqui a cada passo
// do plano que muda o cálculo (ex.: passo 5 estabilização por tempo).
// ---------------------------------------------------------------------

interface Pipeline {
  id: string;
  label: string;
  smoothLandmarks: boolean;
}

const PIPELINES: Pipeline[] = [
  { id: "baseline", label: "Linha de base (sem suavização de pontos)", smoothLandmarks: false },
  { id: "smoothing-v1", label: "Com suavização de pontos (EMA, alpha=" + PRECISION_CONFIG.smoothing.emaAlpha + ")", smoothLandmarks: true },
];

function replay(record: RawFrameRecord, pipeline: Pipeline): { value: number | null; started: boolean } {
  const smoother = pipeline.smoothLandmarks ? new LandmarksSmoother(PRECISION_CONFIG.smoothing.emaAlpha) : null;
  const angleMa = new MovingAverage(5);
  const detectionConfig =
    record.region === "ombro" ? APP_CONFIG.thresholds.movementDetection : KNEE_CONFIG.thresholds.movementDetection;
  const machine = new MovementStateMachine(detectionConfig);

  const neutral =
    record.region === "ombro"
      ? shoulderNeutral(record.calibration, record.side)
      : kneeNeutralSignal(record.test, record.side, record.calibration);
  machine.arm(neutral);

  let started = false;
  for (const sample of record.samples) {
    // Mesma proporção do quadro usada ao vivo (1 em gravações antigas).
    setFrameAspect(sample.aspect ?? 1);
    const landmarks = smoother ? smoother.smooth(sample.landmarks) : sample.landmarks;
    const rawAngle =
      record.region === "ombro"
        ? shoulderRawAngle(record.test, landmarks, record.side)
        : kneeRawSignal(record.test, record.side, landmarks, record.calibration);
    const angle = angleMa.push(rawAngle);
    const detection = machine.update(angle);
    if (detection.justStarted) started = true;
  }

  const peak = machine.getPeakAngle();
  return { value: Number.isFinite(peak) ? peak : null, started };
}

// ---------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? null : num / den;
}

// ---------------------------------------------------------------------
// Leitura simples de CSV (só para o autoteste opcional) — compatível com
// o formato gerado por lib/validation/csv.ts (aspas duplas, vírgula).
// ---------------------------------------------------------------------

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

function main() {
  const [rawPath, csvPath] = process.argv.slice(2);
  if (!rawPath) {
    console.error("Uso: npm run reprocess -- caminho/pontos-brutos.json [caminho/validacao.csv]");
    process.exit(1);
  }

  const records: RawFrameRecord[] = JSON.parse(readFileSync(rawPath, "utf-8"));
  const validRecords = records.filter((r) => r.status === "valida" && r.referenceValueDeg !== null);

  console.log(`Registros no arquivo: ${records.length} (${validRecords.length} válidos com valor de referência)\n`);

  type Row = { region: string; test: string; pipeline: string; error: number; reference: number; value: number };
  const rows: Row[] = [];
  let unstarted = 0;

  for (const record of validRecords) {
    for (const pipeline of PIPELINES) {
      const { value, started } = replay(record, pipeline);
      if (!started) unstarted++;
      if (value === null || record.referenceValueDeg === null) continue;
      rows.push({
        region: record.region,
        test: record.test,
        pipeline: pipeline.id,
        error: value - record.referenceValueDeg,
        reference: record.referenceValueDeg,
        value,
      });
    }
  }

  if (unstarted > 0) {
    console.log(
      `Aviso: em ${unstarted} combinação(ões) repetição×pipeline, o movimento nunca foi "detectado como iniciado" durante o replay — o valor usado foi o ângulo neutro. Vale olhar essas linhas com atenção.\n`
    );
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.region} | ${row.test} | ${row.pipeline}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  console.log("Resumo por região + movimento + versão do algoritmo:\n");
  console.log(
    "regiao".padEnd(10) +
      "movimento".padEnd(14) +
      "algoritmo".padEnd(16) +
      "n".padEnd(5) +
      "erro_medio".padEnd(12) +
      "maior_erro".padEnd(12) +
      "correlacao"
  );
  for (const [key, groupRows] of groups) {
    const [region, test, pipeline] = key.split(" | ");
    const errors = groupRows.map((r) => Math.abs(r.error));
    const values = groupRows.map((r) => r.value);
    const references = groupRows.map((r) => r.reference);
    const corr = pearsonCorrelation(values, references);
    console.log(
      region.padEnd(10) +
        test.padEnd(14) +
        pipeline.padEnd(16) +
        String(groupRows.length).padEnd(5) +
        mean(errors).toFixed(2).padEnd(12) +
        Math.max(...errors).toFixed(2).padEnd(12) +
        (corr === null ? "—" : corr.toFixed(3))
    );
  }

  if (csvPath) {
    console.log("\nAutoteste contra o CSV (mesma versão do algoritmo que gerou a linha):");
    const csvRows = parseCsv(readFileSync(csvPath, "utf-8"));
    let checked = 0;
    let mismatches = 0;
    for (const csvRow of csvRows) {
      const record = validRecords.find((r) => r.recordId === csvRow.id_registro);
      const pipeline = PIPELINES.find((p) => csvRow.versao_algoritmo.includes(p.id));
      if (!record || !pipeline || csvRow.status !== "valida") continue;
      const { value } = replay(record, pipeline);
      const reported = Number(csvRow.pico_estavel_graus);
      checked++;
      if (value === null || Math.abs(value - reported) > 0.5) {
        mismatches++;
        console.log(
          `  id_registro=${csvRow.id_registro}: CSV=${reported}° vs. reprocessado=${value?.toFixed(2)}° (diferença > 0.5°)`
        );
      }
    }
    console.log(`  ${checked} linha(s) conferida(s), ${mismatches} divergência(s) acima de 0.5°.`);
  }
}

main();
