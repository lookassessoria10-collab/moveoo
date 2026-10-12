/**
 * Ângulos conhecidos desenhados em PIXELS e convertidos para as
 * coordenadas normalizadas do MediaPipe (x ÷ largura, y ÷ altura). Com a
 * proporção do quadro informada, cada cálculo devolve o ângulo real —
 * em vídeo em pé (720×1280) e deitado (1280×720). Sem ela (proporção 1,
 * o cálculo antigo), o ângulo sai distorcido.
 */
import { afterEach, describe, expect, it } from "vitest";
import { angleBetweenPoints, angleFromVertical, setFrameAspect } from "../geometry";
import { calculateShoulderFlexionAngle, calculateTrunkAngle } from "../angles";
import { calculateKneeAngle } from "@/modules/knee/angles";
import { tiltFromVerticalDeg } from "@/modules/posture/angles";
import { tiltFromHorizontal } from "@/modules/spine/angles";

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Ponto em pixels → coordenadas normalizadas de um quadro W×H. */
function norm(xPx: number, yPx: number, W: number, H: number) {
  return { x: xPx / W, y: yPx / H };
}

afterEach(() => setFrameAspect(1));

const FRAMES = [
  { name: "celular em pé (720×1280)", W: 720, H: 1280 },
  { name: "celular deitado (1280×720)", W: 1280, H: 720 },
];

describe("proporção do quadro nos ângulos", () => {
  it("documenta o erro antigo: sem a proporção, 45° vira ~60,6° no vídeo em pé", () => {
    const { W, H } = FRAMES[0];
    const a = norm(360, 900, W, H);
    const b = norm(360 + 200 * Math.sin(rad(45)), 900 + 200 * Math.cos(rad(45)), W, H); // 45° da vertical, para baixo
    expect(angleFromVertical(a, b)).toBeCloseTo(60.64, 1);
  });

  for (const { name, W, H } of FRAMES) {
    describe(name, () => {
      it("segmento a 45° da vertical mede 45°", () => {
        setFrameAspect(W / H);
        const a = norm(360, 300, W, H);
        const b = norm(360 + 150 * Math.sin(rad(45)), 300 + 150 * Math.cos(rad(45)), W, H);
        expect(angleFromVertical(a, b)).toBeCloseTo(45, 6);
      });

      it("joelho dobrado a 120° (quadril-joelho-tornozelo) mede 120°", () => {
        setFrameAspect(W / H);
        // Coxa apontando para cima; perna girada 120° a partir dela (em pixels).
        const knee = norm(400, 400, W, H);
        const hip = norm(400, 400 - 180, W, H);
        const ankle = norm(400 + 170 * Math.sin(rad(120)), 400 - 170 * Math.cos(rad(120)), W, H);
        expect(calculateKneeAngle(hip, knee, ankle)).toBeCloseTo(120, 6);
        expect(angleBetweenPoints(hip, knee, ankle)).toBeCloseTo(120, 6);
      });

      it("braço elevado a 90° do tronco mede 90° e a 135° mede 135°", () => {
        setFrameAspect(W / H);
        const shoulder = norm(300, 300, W, H);
        const hip = norm(300, 300 + 250, W, H);
        const arm90 = norm(300 + 180, 300, W, H);
        const arm135 = norm(300 + 180 * Math.sin(rad(135)), 300 + 180 * Math.cos(rad(135)), W, H);
        expect(calculateShoulderFlexionAngle(shoulder, arm90, hip)).toBeCloseTo(90, 6);
        expect(calculateShoulderFlexionAngle(shoulder, arm135, hip)).toBeCloseTo(135, 6);
      });

      it("tronco inclinado 20° mede 20° (inclinação global e postura)", () => {
        setFrameAspect(W / H);
        const hipMid = { px: 400, py: 600 };
        const len = 250;
        const sx = hipMid.px + len * Math.sin(rad(20));
        const sy = hipMid.py - len * Math.cos(rad(20));
        const ls = norm(sx - 40, sy, W, H);
        const rs = norm(sx + 40, sy, W, H);
        const lh = norm(hipMid.px - 40, hipMid.py, W, H);
        const rh = norm(hipMid.px + 40, hipMid.py, W, H);
        expect(calculateTrunkAngle(ls, rs, lh, rh)).toBeCloseTo(20, 6);
        expect(tiltFromVerticalDeg(norm(hipMid.px, hipMid.py, W, H), norm(sx, sy, W, H))).toBeCloseTo(20, 6);
      });

      it("linha dos ombros inclinada 10° mede 10°", () => {
        setFrameAspect(W / H);
        const a = norm(300, 400, W, H);
        const b = norm(300 + 200 * Math.cos(rad(10)), 400 + 200 * Math.sin(rad(10)), W, H);
        expect(tiltFromHorizontal(a, b)).toBeCloseTo(10, 6);
      });
    });
  }

  it("proporção inválida volta ao padrão 1", () => {
    setFrameAspect(Number.NaN);
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 1 };
    expect(angleFromVertical(a, b)).toBeCloseTo(45, 6);
  });
});
