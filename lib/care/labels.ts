/** Rótulos de estado exibidos na interface — sempre com texto (nunca só cor). */
export type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "demo";

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendente: { label: "Aguardando a pessoa", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "info" },
  aguardando_revisao: { label: "Aguardando sua revisão", tone: "warn" },
  revisada: { label: "Revisada e publicada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export const SESSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  iniciada: { label: "Iniciada", tone: "info" },
  concluida: { label: "Concluída", tone: "success" },
  interrompida: { label: "Interrompida", tone: "danger" },
};

export const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  provisorio: { label: "Resultado provisório", tone: "warn" },
  revisado: { label: "Revisado pelo profissional", tone: "success" },
};

export const INVITATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  criado: { label: "Criado, não acessado", tone: "neutral" },
  acessado: { label: "Acessado, sem confirmação", tone: "info" },
  confirmado: { label: "Acesso confirmado", tone: "success" },
  expirado: { label: "Expirado", tone: "neutral" },
  revogado: { label: "Revogado", tone: "neutral" },
};

export const ORIGIN_LABEL: Record<string, { label: string; tone: Tone }> = {
  camera: { label: "Câmera (estimativa automática)", tone: "info" },
  manual_profissional: { label: "Medição do profissional", tone: "neutral" },
  demonstracao: { label: "Demonstração — dado fictício", tone: "demo" },
};

export const QUALITY_LABEL: Record<string, { label: string; tone: Tone }> = {
  apta: { label: "Captura apta", tone: "success" },
  insuficiente: { label: "Captura insuficiente", tone: "danger" },
};

export const DECISION_LABEL: Record<string, { label: string; tone: Tone }> = {
  aceita: { label: "Aceita", tone: "success" },
  corrigida: { label: "Corrigida", tone: "warn" },
  descartada: { label: "Descartada", tone: "neutral" },
};

export const VERIFICATION_LABEL: Record<string, { label: string; tone: Tone }> = {
  pendente: { label: "Registro não verificado", tone: "warn" },
  verificado: { label: "Registro verificado", tone: "success" },
  recusado: { label: "Verificação recusada", tone: "danger" },
};

export const ROLE_LABEL: Record<string, string> = {
  gestor: "Gestor",
  profissional: "Profissional",
  assistente: "Assistente",
};

export const INTERRUPTION_LABEL: Record<string, string> = {
  saiu_da_pagina: "a pessoa saiu da página",
  camera_indisponivel: "câmera indisponível",
  perguntas_de_seguranca: "interrompida pelas perguntas de segurança",
  pessoa_interrompeu: "a pessoa interrompeu",
};

export const CHANNEL_LABEL: Record<string, string> = { email: "E-mail", sms: "SMS", whatsapp: "WhatsApp" };

export const WORKSPACE_KIND_LABEL: Record<string, string> = {
  autonomo: "Profissional autônomo",
  clinica: "Clínica",
  estudio: "Estúdio",
  academia: "Academia",
};

export function formatDate(d: Date | string | null | undefined, withTime = true): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  });
}
