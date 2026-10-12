/**
 * Vocabulário por profissão. A base é comum; muda o nome de quem é
 * atendido e de alguns registros. A interface nunca sugere que a conta de
 * uma categoria concede competências da outra.
 */
export type Profession = "fisioterapia" | "educacao_fisica";

export interface Vocabulary {
  person: string;
  persons: string;
  personArticle: "o" | "a";
  episode: string;
  episodeHint: string;
  professional: string;
  council: string;
}

const NEUTRAL: Vocabulary = {
  person: "pessoa atendida",
  persons: "pessoas atendidas",
  personArticle: "a",
  episode: "objetivo de acompanhamento",
  episodeHint: "Ex.: retorno à corrida, mobilidade do ombro",
  professional: "profissional",
  council: "conselho",
};

export const VOCABULARY: Record<Profession, Vocabulary> = {
  fisioterapia: {
    person: "paciente",
    persons: "pacientes",
    personArticle: "o",
    episode: "episódio de cuidado",
    episodeHint: "Ex.: dor no ombro direito ao elevar o braço",
    professional: "fisioterapeuta",
    council: "CREFITO",
  },
  educacao_fisica: {
    person: "aluno",
    persons: "alunos",
    personArticle: "o",
    episode: "objetivo de treino",
    episodeHint: "Ex.: melhorar a técnica do agachamento",
    professional: "profissional de educação física",
    council: "CREF",
  },
};

export function vocabularyFor(profession: Profession | null | undefined): Vocabulary {
  return profession ? VOCABULARY[profession] : NEUTRAL;
}

export const PROFESSION_LABEL: Record<Profession, string> = {
  fisioterapia: "Fisioterapia",
  educacao_fisica: "Educação física",
};

export const COUNCIL_FOR: Record<Profession, string> = {
  fisioterapia: "CREFITO",
  educacao_fisica: "CREF",
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
