/**
 * Erros de domínio. Acesso negado e "não encontrado" são tratados da
 * mesma forma na interface (404) para não revelar a existência de
 * registros de outro espaço ou de outra pessoa.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: "nao_encontrado" | "acesso_negado" | "invalido" | "bloqueado_liberacao" | "conflito",
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what = "Registro") => new DomainError("nao_encontrado", `${what} não encontrado.`);
export const forbidden = (msg = "Acesso negado.") => new DomainError("acesso_negado", msg);
export const invalid = (msg: string) => new DomainError("invalido", msg);
export const releaseBlocked = (msg: string) => new DomainError("bloqueado_liberacao", msg);
export const conflict = (msg: string) => new DomainError("conflito", msg);

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
