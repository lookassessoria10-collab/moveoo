import { submitAssessmentResult } from "@/lib/server/services/personAccess";
import { withPersonScope } from "@/lib/server/personApi";

export async function POST(req: Request, { params }: { params: { requestId: string } }) {
  return withPersonScope(req, async ({ db, scope, body }) => {
    const { session, duplicate } = await submitAssessmentResult(db, scope, params.requestId, {
      idempotencyKey: String(body.idempotencyKey ?? ""),
      result: body.result,
      device: body.device,
    });
    return { sessionId: session.id, duplicate };
  });
}
