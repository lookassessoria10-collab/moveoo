/**
 * Contas de profissionais: cadastro, confirmação de e-mail, acesso,
 * recuperação de senha e sessões. Independente do Next.js (os cookies
 * ficam em lib/server/session.ts) para poder ser testado com banco em
 * memória.
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { memberships, professionalProfiles, userSessions, userTokens, users, workspaces } from "@/db/schema";
import { ACCESS } from "@/config/platform";
import { COUNCIL_FOR, UFS } from "@/lib/care/vocabulary";
import { hashPassword, randomToken, sha256, verifyPassword } from "../crypto";
import { conflict, invalid } from "../errors";
import { audit, sendMessage } from "./core";

const addHours = (h: number) => new Date(Date.now() + h * 3600_000);

export const registerSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
  password: z
    .string()
    .min(ACCESS.passwordMinLength, `A senha precisa ter pelo menos ${ACCESS.passwordMinLength} caracteres.`)
    .max(200),
  profession: z.enum(["fisioterapia", "educacao_fisica"]),
  councilRegion: z.string().trim().min(1, "Informe a região do conselho.").max(10),
  registrationNumber: z.string().trim().min(2, "Informe o número de registro.").max(30),
  jurisdictionUf: z.enum(UFS),
  workspaceName: z.string().trim().min(2, "Informe o nome do espaço de atendimento.").max(120),
  workspaceKind: z.enum(["autonomo", "clinica", "estudio", "academia"]),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Cria conta + perfil profissional (verificação "pendente") + espaço de
 * DEMONSTRAÇÃO onde o profissional é gestor. Atendimento real exige
 * verificação manual do registro e escolha explícita do ambiente real.
 */
export async function registerProfessional(db: Db, input: RegisterInput, baseUrl: string) {
  const data = registerSchema.parse(input);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (existing.length) throw conflict("Já existe uma conta com este e-mail.");

  const passwordHash = await hashPassword(data.password);
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email: data.email, name: data.name, passwordHash }).returning();
    await tx.insert(professionalProfiles).values({
      userId: user.id,
      profession: data.profession,
      council: COUNCIL_FOR[data.profession],
      councilRegion: data.councilRegion,
      registrationNumber: data.registrationNumber,
      jurisdictionUf: data.jurisdictionUf,
    });
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: data.workspaceName, kind: data.workspaceKind, environment: "demonstracao", createdBy: user.id })
      .returning();
    await tx.insert(memberships).values({ workspaceId: ws.id, userId: user.id, role: "gestor" });
    await issueEmailVerification(tx as unknown as Db, user.id, user.email, baseUrl);
    await audit(tx as unknown as Db, { workspaceId: ws.id, actorType: "usuario", actorId: user.id, action: "conta.criada", objectType: "user", objectId: user.id });
    return { user, workspace: ws };
  });
}

async function issueToken(db: Db, userId: string, purpose: "verificar_email" | "redefinir_senha", hours: number) {
  const token = randomToken();
  await db.insert(userTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: addHours(hours) });
  return token;
}

export async function issueEmailVerification(db: Db, userId: string, email: string, baseUrl: string) {
  const token = await issueToken(db, userId, "verificar_email", ACCESS.emailTokenHours);
  await sendMessage(db, {
    channel: "email",
    recipient: email,
    subject: "Confirme seu e-mail no Moveo",
    body: `Para confirmar seu e-mail, acesse: ${baseUrl}/verificar-email?token=${token}\n\nO link vale por ${ACCESS.emailTokenHours} horas.`,
  });
}

async function consumeToken(db: Db, token: string, purpose: "verificar_email" | "redefinir_senha") {
  const [row] = await db
    .select()
    .from(userTokens)
    .where(
      and(
        eq(userTokens.tokenHash, sha256(token)),
        eq(userTokens.purpose, purpose),
        isNull(userTokens.usedAt),
        gt(userTokens.expiresAt, new Date())
      )
    );
  if (!row) return null;
  await db.update(userTokens).set({ usedAt: new Date() }).where(eq(userTokens.id, row.id));
  return row;
}

export async function verifyEmail(db: Db, token: string): Promise<boolean> {
  const row = await consumeToken(db, token, "verificar_email");
  if (!row) return false;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
  await audit(db, { actorType: "usuario", actorId: row.userId, action: "conta.email_confirmado", objectType: "user", objectId: row.userId });
  return true;
}

export async function requestPasswordReset(db: Db, email: string, baseUrl: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  // Resposta idêntica exista ou não a conta (não revela cadastro).
  if (!user || user.disabledAt) return;
  const token = await issueToken(db, user.id, "redefinir_senha", 1);
  await sendMessage(db, {
    channel: "email",
    recipient: user.email,
    subject: "Redefinição de senha do Moveo",
    body: `Para criar uma nova senha, acesse: ${baseUrl}/redefinir-senha?token=${token}\n\nO link vale por 1 hora. Se você não pediu, ignore esta mensagem.`,
  });
}

export async function resetPassword(db: Db, token: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < ACCESS.passwordMinLength) {
    throw invalid(`A senha precisa ter pelo menos ${ACCESS.passwordMinLength} caracteres.`);
  }
  const row = await consumeToken(db, token, "redefinir_senha");
  if (!row) return false;
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, row.userId));
  // Encerra todas as sessões abertas.
  await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.userId, row.userId));
  await audit(db, { actorType: "usuario", actorId: row.userId, action: "conta.senha_redefinida", objectType: "user", objectId: row.userId });
  return true;
}

export type LoginResult =
  | { ok: true; token: string; userId: string }
  | { ok: false; reason: "credenciais" | "bloqueado" };

/** Limita tentativas por conta: após N falhas, bloqueia por alguns minutos. */
export async function login(db: Db, emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.disabledAt) {
    // Custo semelhante ao caminho real, para não revelar se a conta existe.
    await hashPassword(password);
    return { ok: false, reason: "credenciais" };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, reason: "bloqueado" };

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= ACCESS.loginMaxFailures;
    await db
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : failures,
        lockedUntil: lock ? new Date(Date.now() + ACCESS.loginLockMinutes * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    await audit(db, { actorType: "usuario", actorId: user.id, action: lock ? "acesso.bloqueado" : "acesso.falha", objectType: "user", objectId: user.id });
    return { ok: false, reason: lock ? "bloqueado" : "credenciais" };
  }

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  const token = randomToken();
  await db.insert(userSessions).values({
    tokenHash: sha256(token),
    userId: user.id,
    expiresAt: addHours(ACCESS.userSessionDays * 24),
  });
  await audit(db, { actorType: "usuario", actorId: user.id, action: "acesso.entrada", objectType: "user", objectId: user.id });
  return { ok: true, token, userId: user.id };
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.tokenHash, sha256(token)));
}

export async function userFromSessionToken(db: Db, token: string) {
  const [row] = await db
    .select({ user: users, session: userSessions })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, sha256(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date())
      )
    );
  if (!row || row.user.disabledAt) return null;
  return row.user;
}

/** Marca o tutorial de boas-vindas como visto (concluído ou pulado). Guarda só a primeira vez. */
export async function markTutorialSeen(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ tutorialSeenAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.tutorialSeenAt)));
}
