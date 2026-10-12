"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { decideVerification, recordReleaseDecision } from "@/lib/server/services/admin";
import { requireAdmin, runAction, type ActionState } from "@/lib/server/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function decideVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await runAction(async () => {
    await decideVerification(await getDb(), admin.id, {
      userId: str(fd, "userId"),
      status: str(fd, "status") as "verificado",
      source: str(fd, "source"),
      note: str(fd, "note"),
    });
  });
  revalidatePath("/admin");
  return res;
}

export async function recordReleaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await runAction(async () => {
    await recordReleaseDecision(await getDb(), admin.id, {
      featureKey: str(fd, "featureKey"),
      algorithmVersion: str(fd, "algorithmVersion"),
      protocolVersion: str(fd, "protocolVersion"),
      state: str(fd, "state") as "desenvolvimento",
      scope: str(fd, "scope"),
      evidence: str(fd, "evidence"),
    });
  });
  revalidatePath("/admin/liberacoes");
  return res;
}
