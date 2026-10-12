/**
 * Cenário FICTÍCIO usado no desenvolvimento local (npm run db:seed) e nos
 * testes de isolamento. Todas as pessoas e contas são inventadas; os
 * e-mails usam o domínio reservado ".test", que não entrega mensagens.
 *
 * Senha de todas as contas de demonstração: DEMO_PASSWORD (abaixo).
 * Uso exclusivamente local — nunca reutilize em outro ambiente.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./client";
import { careEpisodes, careRelationships, memberships, persons, professionalProfiles, users, workspaces } from "./schema";
import { hashPassword } from "@/lib/server/crypto";
import { ensureConsentDocuments } from "@/lib/server/services/core";

export const DEMO_PASSWORD = "moveo-demo-local";

type Profession = "fisioterapia" | "educacao_fisica";

async function createUser(
  db: Db,
  passwordHash: string,
  u: { email: string; name: string; admin?: boolean; profession?: Profession; uf?: string; verified?: boolean }
) {
  const [user] = await db
    .insert(users)
    .values({ email: u.email, name: u.name, passwordHash, emailVerifiedAt: new Date(), isPlatformAdmin: !!u.admin })
    .returning();
  if (u.profession) {
    await db.insert(professionalProfiles).values({
      userId: user.id,
      profession: u.profession,
      council: u.profession === "fisioterapia" ? "CREFITO" : "CREF",
      councilRegion: u.profession === "fisioterapia" ? "3" : "4/SP",
      registrationNumber: u.profession === "fisioterapia" ? "000000-F (fictício)" : "000000-G/SP (fictício)",
      jurisdictionUf: u.uf ?? "SP",
      verificationStatus: u.verified ? "verificado" : "pendente",
      verificationSource: u.verified ? "Cenário fictício de desenvolvimento — não é conferência real" : null,
      verifiedAt: u.verified ? new Date() : null,
    });
  }
  return user;
}

export async function seedScenario(db: Db) {
  await ensureConsentDocuments(db);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await createUser(db, passwordHash, { email: "admin@moveo.test", name: "Administração Moveo (fictícia)", admin: true });
  const ana = await createUser(db, passwordHash, { email: "ana.fisio@moveo.test", name: "Ana Fisioterapeuta (fictícia)", profession: "fisioterapia" });
  const bruno = await createUser(db, passwordHash, { email: "bruno.fisio@moveo.test", name: "Bruno Fisioterapeuta (fictício)", profession: "fisioterapia" });
  const carla = await createUser(db, passwordHash, { email: "carla.recepcao@moveo.test", name: "Carla Recepção (fictícia)" });
  const diego = await createUser(db, passwordHash, { email: "diego.ef@moveo.test", name: "Diego Educador Físico (fictício)", profession: "educacao_fisica", verified: true });

  const [clinica] = await db
    .insert(workspaces)
    .values({ name: "Clínica Movimento — demonstração", kind: "clinica", environment: "demonstracao", createdBy: ana.id })
    .returning();
  const [estudio] = await db
    .insert(workspaces)
    .values({ name: "Estúdio Força — demonstração", kind: "estudio", environment: "demonstracao", brandColor: "#1B3A4B", createdBy: diego.id })
    .returning();

  await db.insert(memberships).values([
    { workspaceId: clinica.id, userId: ana.id, role: "gestor" },
    { workspaceId: clinica.id, userId: bruno.id, role: "profissional" },
    { workspaceId: clinica.id, userId: carla.id, role: "assistente" },
    { workspaceId: estudio.id, userId: diego.id, role: "gestor" },
  ]);

  const addPerson = async (
    ws: typeof clinica,
    createdBy: string,
    professionalId: string,
    p: { fullName: string; email: string; phone?: string; episode: string; modality: "remoto" | "hibrido" | "presencial" }
  ) => {
    const [person] = await db
      .insert(persons)
      .values({
        workspaceId: ws.id,
        fullName: p.fullName,
        email: p.email,
        phone: p.phone ?? null,
        preferredChannel: "email",
        city: "São Paulo",
        uf: "SP",
        isFictitious: true,
        createdBy,
      })
      .returning();
    await db.insert(careRelationships).values({ workspaceId: ws.id, personId: person.id, professionalUserId: professionalId, createdBy });
    await db.insert(careEpisodes).values({
      workspaceId: ws.id,
      personId: person.id,
      title: p.episode,
      modality: p.modality,
      remoteSuitabilityNote: "Cenário fictício: acompanhamento remoto considerado adequado para fins de demonstração.",
      openedBy: professionalId,
    });
    return person;
  };

  const joao = await addPerson(clinica, ana.id, ana.id, {
    fullName: "João Exemplo (fictício)",
    email: "joao.paciente@moveo.test",
    phone: "11900000001",
    episode: "Dor no ombro direito ao elevar o braço (fictício)",
    modality: "hibrido",
  });
  const maria = await addPerson(clinica, bruno.id, bruno.id, {
    fullName: "Maria Exemplo (fictícia)",
    email: "maria.paciente@moveo.test",
    episode: "Retorno às caminhadas após entorse (fictício)",
    modality: "remoto",
  });
  const pedro = await addPerson(estudio, diego.id, diego.id, {
    fullName: "Pedro Exemplo (fictício)",
    email: "pedro.aluno@moveo.test",
    episode: "Melhorar a técnica do agachamento (fictício)",
    modality: "hibrido",
  });

  return { admin, ana, bruno, carla, diego, clinica, estudio, joao, maria, pedro };
}

export async function isSeeded(db: Db): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, "admin@moveo.test"));
  return rows.length > 0;
}
