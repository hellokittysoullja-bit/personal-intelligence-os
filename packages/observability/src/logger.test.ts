import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("создаёт pino-логгер с заданным service и уровнем", () => {
    const logger = createLogger({ service: "test-service", level: "debug" });
    expect(logger.level).toBe("debug");
  });

  it("по умолчанию использует уровень info", () => {
    const logger = createLogger({ service: "test-service" });
    expect(logger.level).toBe("info");
  });

  it("редактирует секреты в логах", () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    const logger = createLogger({ service: "test-service", destination });
    logger.info({ user: { password: "super-secret" } }, "login attempt");

    const output = chunks.join("\n");
    expect(output).not.toContain("super-secret");
    expect(output).toContain("[REDACTED]");
  });
});
