/**
 * Базовый класс доменных ошибок (см. docs/ARCHITECTURE.md §1.1).
 * Инфраструктурные ошибки (сеть, БД, файловая система) не должны
 * наследоваться от DomainError — они принадлежат infrastructure-слою.
 */
export class DomainError extends Error {
  public readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DomainError";
    this.code = code;
  }
}

/**
 * Недопустимый переход конечного автомата (Mission/Task/AgentJob status).
 * См. docs/DOMAIN_MODEL.md — переходы, кроме перечисленных явно, запрещены.
 */
export class InvalidTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super(
      "INVALID_TRANSITION",
      `Недопустимый переход ${entity}: ${from} -> ${to}`,
    );
    this.name = "InvalidTransitionError";
  }
}
