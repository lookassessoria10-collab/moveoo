import { startAssessment } from "@/lib/server/services/personAccess";
import { withPersonScope } from "@/lib/server/personApi";

export async function POST(req: Request, { params }: { params: { requestId: string } }) {
  return withPersonScope(req, async ({ db, scope, body }) => {
    const s = await startAssessment(db, scope, params.requestId, {
      idempotencyKey: String(body.idempotencyKey ?? ""),
      device: body.device,
    });
    return { sessionId: s.id };
  });
}
