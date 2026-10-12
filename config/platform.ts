/**
 * Configuração da plataforma Moveo (área do profissional, convites,
 * sessões). A identidade da UORT continua em config/app.ts e vale para as
 * rotas públicas de avaliação livre (/assessment/*); dentro do
 * acompanhamento, a pessoa vê a identidade do espaço que a convidou.
 */
import pkg from "../package.json";

export const PLATFORM = {
  name: "Moveo",
  tagline: "Acompanhamento de movimento para fisioterapia e educação física",
  appVersion: pkg.version,
} as const;

export const ACCESS = {
  /** Sessão do profissional. MFA ainda não implementado — ver docs/plataforma.md. */
  userSessionDays: 7,
  /** Sessão da pessoa atendida (escopo: a solicitação do convite). */
  personSessionHours: 24,
  inviteDefaultDays: 7,
  inviteMaxDays: 30,
  codeMinutes: 10,
  codeMaxAttempts: 5,
  codeResendSeconds: 60,
  loginMaxFailures: 5,
  loginLockMinutes: 15,
  emailTokenHours: 24,
  passwordMinLength: 10,
} as const;

export const COOKIES = {
  user: "moveo_sessao",
  person: "moveo_pessoa",
  workspace: "moveo_espaco",
} as const;
