import { afterEach, describe, expect, it, vi } from "vitest";
import { startRecoveryLoop } from "./recovery-loop";

afterEach(() => {
  vi.useRealTimers();
});

describe("startRecoveryLoop", () => {
  it("выполняет reconciliation на старте и останавливает периодический loop", async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn().mockResolvedValue({ blockedIds: [] });
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const loop = startRecoveryLoop({ reconcile, intervalMs: 5_000, logger });

    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    loop.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("не допускает параллельный reconciliation и логирует blocked recovery jobs", async () => {
    let resolve!: (value: { blockedIds: string[] }) => void;
    const reconcile = vi.fn().mockReturnValue(new Promise<{ blockedIds: string[] }>((done) => { resolve = done; }));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const loop = startRecoveryLoop({ reconcile, intervalMs: 5_000, logger });

    await loop.runOnce();
    expect(reconcile).toHaveBeenCalledTimes(1);
    resolve({ blockedIds: ["job-1"] });
    await Promise.resolve();
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith({ blockedJobIds: ["job-1"] }, "durable jobs blocked for explicit recovery");
    loop.stop();
  });
});
