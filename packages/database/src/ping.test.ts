import { describe, expect, it } from "vitest";
import { pingDatabase } from "./ping";
import type postgres from "postgres";

function fakeSql(handler: () => Promise<unknown>): postgres.Sql {
  return handler as unknown as postgres.Sql;
}

describe("pingDatabase", () => {
  it("возвращает true, если запрос выполняется успешно", async () => {
    const sql = fakeSql(() => Promise.resolve([{ "?column?": 1 }]));
    await expect(pingDatabase(sql)).resolves.toBe(true);
  });

  it("возвращает false, если запрос падает с ошибкой", async () => {
    const sql = fakeSql(() => Promise.reject(new Error("connection refused")));
    await expect(pingDatabase(sql)).resolves.toBe(false);
  });

  it("возвращает false по таймауту", async () => {
    const sql = fakeSql(() => new Promise(() => {}));
    await expect(pingDatabase(sql, 20)).resolves.toBe(false);
  });
});
