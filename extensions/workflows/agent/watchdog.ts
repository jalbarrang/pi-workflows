import { FIRST_RESPONSE_TIMEOUT_MS } from "../run/limits.ts";

function formatTimeout(timeoutMs: number) {
  return timeoutMs % 1_000 === 0 ? `${timeoutMs / 1_000} seconds` : `${timeoutMs} ms`;
}

export function createFirstResponseWatchdog(
  onTimeout: () => Promise<unknown>,
  options: { timeoutMs?: number; model?: string } = {},
) {
  const timeoutMs = options.timeoutMs ?? FIRST_RESPONSE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timer = undefined;
      const model = options.model ? ` for ${options.model}` : "";
      reject(
        new Error(
          `Agent received no assistant response event${model} within ${formatTimeout(timeoutMs)}; ` +
            "the provider request may be stalled. Retry the workflow.",
        ),
      );
      void onTimeout().catch(() => {});
    }, timeoutMs);
    timer.unref?.();
  });
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return {
    markResponse: cancel,
    async waitFor<T>(operation: Promise<T>) {
      try {
        return await Promise.race([operation, timeout]);
      } finally {
        cancel();
      }
    },
  };
}
