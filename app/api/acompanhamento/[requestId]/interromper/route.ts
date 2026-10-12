import { interruptAssessment } from "@/lib/server/services/personAccess";
import { withPersonScope } from "@/lib/server/personApi";

export async function POST(req: Request, { params }: { params: { requestId: string } }) {
  return withPersonScope(req, async ({ db, scope, body }) => {
    await interruptAssessment(db, scope, params.requestId, {
      idempotencyKey: String(body.idempotencyKey ?? ""),
      reason: String(body.reason ?? ""),
    });
    return {};
  });
}
