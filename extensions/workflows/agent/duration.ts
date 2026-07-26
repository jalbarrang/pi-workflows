/** Bound one agent's model loop and abort its active session when time expires. */
export function createAgentDurationGuard(onTimeout: () => Promise<unknown>, timeoutMs?: number) {
  let exceeded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout =
    timeoutMs === undefined
      ? undefined
      : new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            timer = undefined;
            exceeded = true;
            reject(new Error(`Agent exceeded maxDurationMs of ${timeoutMs} ms`));
            void onTimeout().catch(() => {});
          }, timeoutMs);
          timer.unref?.();
        });
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return {
    cancel,
    exceeded: () => exceeded,
    async waitFor<T>(operation: Promise<T>) {
      if (!timeout) return operation;
      try {
        return await Promise.race([operation, timeout]);
      } finally {
        cancel();
      }
    },
  };
}
