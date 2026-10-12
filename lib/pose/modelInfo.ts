/**
 * Identificação do modelo e do runtime de rastreamento corporal. Fica num
 * arquivo sem dependências para que o servidor possa registrar essas
 * versões em cada resultado (rastreabilidade) sem importar o MediaPipe.
 *
 * Atenção (auditoria, docs/auditoria.md): o pacote npm instalado é
 * @mediapipe/tasks-vision 0.10.35, mas o runtime wasm é baixado da versão
 * 0.10.17. Os dois números ficam registrados até a divergência ser
 * resolvida e revalidada.
 */
export const POSE_WASM_VERSION = "0.10.17";
export const POSE_JS_VERSION = "0.10.35";
export const POSE_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_WASM_VERSION}/wasm`;
export const POSE_MODEL_ID = "pose_landmarker_full/float16/1";
export const POSE_MODEL_URL = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${POSE_MODEL_ID}/pose_landmarker_full.task`;
export const POSE_RUNTIME_LABEL = `tasks-vision js ${POSE_JS_VERSION} / wasm ${POSE_WASM_VERSION}`;
