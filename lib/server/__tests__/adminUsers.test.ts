/**
 * Gestão de usuários pela administração (PGlite em memória, cenário
 * fictício): filtros, números, edição, desativação, exclusão só de contas
 * sem registros, etiquetas, anotações e planilha.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { createTestDb, type Db } from "@/db/client";
import { seedScenario, DEMO_PASSWORD } from "@/db/seed-data";
import { auditEvents, professionalProfiles, userTokens, users, workspaces } from "@/db/schema";
import { login, registerProfessional, userFromSessionToken } from "../services/accounts";
import {
  addUserNote,
  addUserTag,
  confirmEmailManually,
  csvCell,
  deactivateUser,
  deleteUser,
  deleteUserNote,
  deletionBlockers,
  getAdminOverview,
  getUserDetail,
  listTags,
  listUsers,
  normalizeTag,
  parseUserFilters,
  reactivateUser,
  removeUserTag,
  setPlatformAdmin,
  updateAccount,
  updateProfessionalProfile,
  usersToCsv,
} from "../services/adminUsers";
import { isDomainError } from "../errors";

let db: Db;
let close: () => Promise<void>;
let s: Awaited<ReturnType<typeof seedScenario>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  s = await seedScenario(db);
});
afterAll(async () => close());

async function expectError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    if (isDomainError(e)) {
      expect(e.code).toBe(code);
      return;
    }
    throw e;
  }
  throw new Error(`Era esperado o erro "${code}"`);
}

const emails = (rows: { email: string }[]) => rows.map((r) => r.email).sort();

describe("lista e filtros", () => {
  it("só a administração da plataforma acessa", async () => {
    await expectError(listUsers(db, s.ana.id, {}), "acesso_negado");
    await expectError(getAdminOverview(db, s.diego.id), "acesso_negado");
  });

  it("filtra por profissão, perfil, busca e situação", async () => {
    const all = await listUsers(db, s.admin.id, {});
    expect(all.total).toBe(5);
    expect(all.rows[0]).toMatchObject({ workspaces: expect.any(Number), tags: [] });

    expect(emails((await listUsers(db, s.admin.id, { profissao: "fisioterapia" })).rows)).toEqual(["ana.fisio@moveo.test", "bruno.fisio@moveo.test"]);
    expect(emails((await listUsers(db, s.admin.id, { profissao: "sem_perfil" })).rows)).toEqual(["admin@moveo.test", "carla.recepcao@moveo.test"]);
    expect(emails((await listUsers(db, s.admin.id, { q: "DIEGO" })).rows)).toEqual(["diego.ef@moveo.test"]);
    expect(emails((await listUsers(db, s.admin.id, { q: "100%_" })).rows)).toEqual([]);
    expect(emails((await listUsers(db, s.admin.id, { verificacao: "verificado" })).rows)).toEqual(["diego.ef@moveo.test"]);
    expect(emails((await listUsers(db, s.admin.id, { situacao: "administracao" })).rows)).toEqual(["admin@moveo.test"]);

    const ana = (await listUsers(db, s.admin.id, { q: "ana.fisio" })).rows[0];
    expect(ana).toMatchObject({ persons: 1, workspaces: 1, realWorkspaces: 0, profession: "fisioterapia" });
  });

  it("filtros inválidos na URL são ignorados", () => {
    expect(parseUserFilters({ profissao: "astronauta", uf: "SP", pagina: "2", q: "", ordem: ["nome", "x"] })).toEqual({
      uf: "SP",
      pagina: 2,
      ordem: "nome",
    });
  });
});

describe("números da base", () => {
  it("conta profissionais e equipes, fora a administração, com funil de ativação", async () => {
    const o = await getAdminOverview(db, s.admin.id);
    expect(o.totals).toMatchObject({ accounts: 4, active: 4, fisioterapia: 2, educacaoFisica: 1, noProfile: 1, verificationPending: 2 });
    expect(o.funnel.map((f) => f.users)).toEqual([4, 3, 0, 0, 0]);
    expect(o.weekly).toHaveLength(12);
    expect(o.weekly.at(-1)!.users).toBe(4);
    expect(o.byUf).toEqual([{ uf: "SP", users: 3 }]);
    expect(o.activity30.persons).toBe(3);
  });

  it("desconsidera contas com a etiqueta escolhida", async () => {
    await addUserTag(db, s.admin.id, s.carla.id, "teste");
    const o = await getAdminOverview(db, s.admin.id, { ignoreTag: "teste" });
    expect(o.totals.accounts).toBe(3);
    await removeUserTag(db, s.admin.id, s.carla.id, "teste");
  });
});

describe("etiquetas e anotações", () => {
  it("normaliza etiquetas e recusa caracteres fora do padrão", async () => {
    expect(normalizeTag("  Beta   Tester ")).toBe("beta tester");
    expect(normalizeTag("Fisioterapia-SP")).toBe("fisioterapia-sp");
    expect(() => normalizeTag("a,b")).toThrow(/Use só letras/);
    expect(() => normalizeTag("   ")).toThrow(/Informe/);
  });

  it("adiciona, filtra e remove etiquetas", async () => {
    await addUserTag(db, s.admin.id, s.ana.id, "Beta");
    await addUserTag(db, s.admin.id, s.ana.id, "beta"); // repetida não duplica
    await addUserTag(db, s.admin.id, s.bruno.id, "lead");
    expect(await listTags(db, s.admin.id)).toEqual([
      { tag: "beta", users: 1 },
      { tag: "lead", users: 1 },
    ]);
    const tagged = await listUsers(db, s.admin.id, { etiqueta: "beta" });
    expect(emails(tagged.rows)).toEqual(["ana.fisio@moveo.test"]);
    expect(tagged.rows[0].tags).toEqual(["beta"]);
    await removeUserTag(db, s.admin.id, s.bruno.id, "lead");
    expect((await listUsers(db, s.admin.id, { etiqueta: "lead" })).total).toBe(0);
  });

  it("anotação só pode ser apagada por quem escreveu", async () => {
    const note = await addUserNote(db, s.admin.id, { userId: s.ana.id, body: "Pediu demonstração para a equipe." });
    await setPlatformAdmin(db, s.admin.id, s.diego.id, true);
    await expectError(deleteUserNote(db, s.diego.id, note.id), "acesso_negado");
    await setPlatformAdmin(db, s.admin.id, s.diego.id, false);
    expect((await getUserDetail(db, s.admin.id, s.ana.id)).notes).toHaveLength(1);
    await deleteUserNote(db, s.admin.id, note.id);
    expect((await getUserDetail(db, s.admin.id, s.ana.id)).notes).toHaveLength(0);
  });
});

describe("edição da conta e do registro", () => {
  it("trocar o e-mail exige nova confirmação e invalida links enviados ao endereço antigo", async () => {
    const { user } = await registerProfessional(
      db,
      {
        name: "Eva Exemplo",
        email: "eva@moveo.test",
        password: "senha-de-teste-123",
        profession: "fisioterapia",
        councilRegion: "3",
        registrationNumber: "000003-F",
        jurisdictionUf: "SP",
        workspaceName: "Consultório Eva",
        workspaceKind: "autonomo",
      },
      "http://localhost:3000"
    );
    await confirmEmailManually(db, s.admin.id, user.id);
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0].emailVerifiedAt).toBeInstanceOf(Date);

    await expectError(updateAccount(db, s.admin.id, { userId: user.id, name: "Eva Exemplo", email: "ana.fisio@moveo.test" }), "conflito");
    expect(await updateAccount(db, s.admin.id, { userId: user.id, name: "Eva Nova Exemplo", email: "Eva.Nova@moveo.test" })).toEqual({
      changed: ["nome", "email"],
    });
    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after).toMatchObject({ name: "Eva Nova Exemplo", email: "eva.nova@moveo.test", emailVerifiedAt: null });
    expect(await db.select().from(userTokens).where(and(eq(userTokens.userId, user.id), isNull(userTokens.usedAt)))).toHaveLength(0);
  });

  it("mudar o registro volta a verificação para pendente", async () => {
    const same = await updateProfessionalProfile(db, s.admin.id, {
      userId: s.diego.id,
      profession: "educacao_fisica",
      councilRegion: "4/SP",
      registrationNumber: "000000-G/SP (fictício)",
      jurisdictionUf: "SP",
    });
    expect(same.verificationReset).toBe(false);

    const changed = await updateProfessionalProfile(db, s.admin.id, {
      userId: s.diego.id,
      profession: "educacao_fisica",
      councilRegion: "4/SP",
      registrationNumber: "123456-G/SP",
      jurisdictionUf: "SP",
    });
    expect(changed).toEqual({ changed: ["registrationNumber"], verificationReset: true });
    const [p] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, s.diego.id));
    expect(p).toMatchObject({ verificationStatus: "pendente", council: "CREF", verifiedAt: null });
  });

  it("ninguém altera o próprio acesso de administração", async () => {
    await expectError(setPlatformAdmin(db, s.admin.id, s.admin.id, false), "acesso_negado");
  });
});

describe("desativar e reativar", () => {
  it("desativada não entra, perde as sessões abertas e volta ao ser reativada", async () => {
    const before = await login(db, "bruno.fisio@moveo.test", DEMO_PASSWORD);
    if (!before.ok) throw new Error("login falhou");
    await expect(deactivateUser(db, s.admin.id, { userId: s.bruno.id, reason: "" })).rejects.toThrow(/Informe o motivo/);
    await deactivateUser(db, s.admin.id, { userId: s.bruno.id, reason: "Pedido do próprio profissional" });

    expect(await userFromSessionToken(db, before.token)).toBeNull();
    expect((await login(db, "bruno.fisio@moveo.test", DEMO_PASSWORD)).ok).toBe(false);
    expect(emails((await listUsers(db, s.admin.id, { situacao: "desativada" })).rows)).toEqual(["bruno.fisio@moveo.test"]);
    expect((await getUserDetail(db, s.admin.id, s.bruno.id)).user.disabledReason).toBe("Pedido do próprio profissional");

    await reactivateUser(db, s.admin.id, s.bruno.id);
    expect((await login(db, "bruno.fisio@moveo.test", DEMO_PASSWORD)).ok).toBe(true);
  });

  it("a administração não desativa a própria conta", async () => {
    await expectError(deactivateUser(db, s.admin.id, { userId: s.admin.id, reason: "teste" }), "acesso_negado");
  });
});

describe("exclusão definitiva", () => {
  it("conta com registros de atendimento não pode ser excluída", async () => {
    const blockers = await deletionBlockers(db, s.ana.id);
    expect(blockers.join(" ")).toMatch(/Cadastrou 1 pessoa atendida/);
    expect(blockers.join(" ")).toMatch(/Criou o espaço “Clínica Movimento — demonstração”/);
    await expectError(deleteUser(db, s.admin.id, { userId: s.ana.id, confirmEmail: "ana.fisio@moveo.test" }), "invalido");
    expect(await deletionBlockers(db, s.admin.id)).toEqual([expect.stringMatching(/administração/)]);
  });

  it("conta sem registros é excluída com o espaço vazio que criou; a auditoria guarda só o fato", async () => {
    const { user, workspace } = await registerProfessional(
      db,
      {
        name: "Fábio Abandonou",
        email: "fabio@moveo.test",
        password: "senha-de-teste-123",
        profession: "educacao_fisica",
        councilRegion: "4/SP",
        registrationNumber: "000004-G/SP",
        jurisdictionUf: "RJ",
        workspaceName: "Espaço do Fábio",
        workspaceKind: "autonomo",
      },
      "http://localhost:3000"
    );
    await addUserTag(db, s.admin.id, user.id, "abandonou");
    await addUserNote(db, s.admin.id, { userId: user.id, body: "Não respondeu ao contato." });
    expect(await deletionBlockers(db, user.id)).toEqual([]);

    await expectError(deleteUser(db, s.admin.id, { userId: user.id, confirmEmail: "outro@moveo.test" }), "invalido");
    expect(await deleteUser(db, s.admin.id, { userId: user.id, confirmEmail: " FABIO@moveo.test " })).toEqual({ deletedWorkspaces: 1 });

    expect(await db.select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
    expect(await db.select().from(workspaces).where(eq(workspaces.id, workspace.id))).toHaveLength(0);
    expect(await listTags(db, s.admin.id)).not.toContainEqual(expect.objectContaining({ tag: "abandonou" }));
    const [event] = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "usuario.excluido"), eq(auditEvents.objectId, user.id)));
    expect(event.metadata).toEqual({ espacos_excluidos: 1 });
  });

  it("assistente sem registros sai da equipe sem apagar o espaço de outra pessoa", async () => {
    await deleteUser(db, s.admin.id, { userId: s.carla.id, confirmEmail: "carla.recepcao@moveo.test" });
    expect(await db.select().from(workspaces).where(eq(workspaces.id, s.clinica.id))).toHaveLength(1);
    await expectError(getUserDetail(db, s.admin.id, s.carla.id), "nao_encontrado");
  });
});

describe("planilha", () => {
  it("protege contra fórmulas e separa por ponto e vírgula", async () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    const csv = usersToCsv((await listUsers(db, s.admin.id, { q: "ana.fisio" }, { all: true })).rows);
    const [header, line] = csv.replace("﻿", "").trim().split("\r\n");
    expect(header.split(";")).toHaveLength(18);
    expect(line).toMatch(/^Ana Fisioterapeuta \(fictícia\);ana\.fisio@moveo\.test;sim;Fisioterapia;CREFITO;/);
  });
});
