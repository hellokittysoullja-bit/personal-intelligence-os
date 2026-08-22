import type { ReconcileDurableJobs } from "@pios/application";

interface RecoveryLogger {
  info(bindings: object, message?: string): void;
  error(bindings: object, message?: string): void;
  warn(bindings: object, message?: string): void;
}

export interface RecoveryLoopOptions {
  reconcile: ReconcileDurableJobs;
  intervalMs: number;
  logger: RecoveryLogger;
}

export interface RecoveryLoop {
  stop(): void;
  runOnce(): Promise<void>;
}

/**
 * Этот loop не исполняет queued jobs. Он реализует только crash-recovery
 * из ADR-010: просроченный running job блокируется до явного решения.
 */
export function startRecoveryLoop({ reconcile, intervalMs, logger }: RecoveryLoopOptions): RecoveryLoop {
  let inFlight = false;
  let stopped = false;

  async function runOnce(): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const { blockedIds } = await reconcile();
      if (blockedIds.length > 0) {
        logger.warn({ blockedJobIds: blockedIds }, "durable jobs blocked for explicit recovery");
      }
    } catch (error) {
      logger.error({ error }, "durable job reconciliation failed");
    } finally {
      inFlight = false;
    }
  }

  void runOnce();
  const timer = setInterval(() => { void runOnce(); }, intervalMs);
  timer.unref();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    runOnce,
  };
}
