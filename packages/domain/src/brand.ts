/**
 * Номинальная типизация для доменных идентификаторов (MissionId, TaskId и
 * т.д. — появятся в Milestone 2). Предотвращает случайную подмену одного
 * строкового id другим на уровне типов.
 */
export type Brand<Value, BrandName extends string> = Value & {
  readonly __brand: BrandName;
};
