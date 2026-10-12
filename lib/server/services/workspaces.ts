/**
 * Espaços de atendimento. Ambientes não se misturam: um espaço de
 * demonstração nunca vira real (os registros fictícios continuariam lá).
 * Para atender pessoas reais, cria-se um espaço real, o que exige registro
 * profissional verificado.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { memberships, professionalProfiles, workspaces } from "@/db/schema";
import { forbidden } from "../errors";
import { audit } from "./core";
import { requireRole, type WorkspaceContext } from "./authz";

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do espaço.").max(120),
  kind: z.enum(["autonomo", "clinica", "estudio", "academia"]),
  environment: z.enum(["demonstracao", "real"]),
});

export async function createWorkspace(db: Db, userId: string, input: z.input<typeof workspaceSchema>) {
  const data = workspaceSchema.parse(input);
  if (data.environment === "real") {
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId));
    if (profile?.verificationStatus !== "verificado") {
      throw forbidden("Espaços de atendimento real exigem registro profissional verificado.");
    }
  }
  const [ws] = await db.insert(workspaces).values({ ...data, createdBy: userId }).returning();
  await db.insert(memberships).values({ workspaceId: ws.id, userId, role: "gestor" });
  await audit(db, { workspaceId: ws.id, actorType: "usuario", actorId: userId, action: "espaco.criado", objectType: "workspace", objectId: ws.id, metadata: { ambiente: data.environment } });
  return ws;
}

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)."),
});

export async function updateWorkspaceSettings(db: Db, ctx: WorkspaceContext, input: z.input<typeof settingsSchema>) {
  requireRole(ctx, "gestor");
  const data = settingsSchema.parse(input);
  await db.update(workspaces).set(data).where(eq(workspaces.id, ctx.workspace.id));
  await audit(db, { workspaceId: ctx.workspace.id, actorType: "usuario", actorId: ctx.userId, action: "espaco.configuracao_alterada", objectType: "workspace", objectId: ctx.workspace.id });
}
