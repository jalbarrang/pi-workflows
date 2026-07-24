import type { SessionShutdownEvent } from "@earendil-works/pi-coding-agent";

const SHUTDOWN_TIMEOUT_MS = 5_000;
const shutdowns = new WeakMap<object, Promise<void>>();

export interface DisposableChildSession {
  extensionRunner: {
    hasHandlers(eventType: string): boolean;
    emit(event: SessionShutdownEvent): Promise<unknown>;
  };
  dispose(): void;
}

export function shutdownChildSession(
  session: DisposableChildSession,
  options: { timeoutMs?: number } = {},
) {
  const saved = shutdowns.get(session);
  if (saved) return saved;
  const operation = (async () => {
    try {
      const runner = session.extensionRunner;
      if (runner.hasHandlers("session_shutdown")) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<void>((resolve) => {
          timer = setTimeout(resolve, options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS);
        });
        await Promise.race([
          runner.emit({ type: "session_shutdown", reason: "quit" }).then(() => undefined),
          timeout,
        ]).catch(() => {});
        if (timer) clearTimeout(timer);
      }
    } catch {
    } finally {
      try {
        session.dispose();
      } catch {}
    }
  })();
  shutdowns.set(session, operation);
  return operation;
}
