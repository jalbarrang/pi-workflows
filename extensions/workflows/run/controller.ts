import { Effect, Ref, Semaphore } from "effect";
import { abortError, reserveCall } from "./controller-support.ts";
import { MAX_AGENT_CALLS, MAX_CONCURRENCY, RUN_SHUTDOWN_TIMEOUT_MS } from "./limits.ts";

export { MAX_AGENT_CALLS } from "./limits.ts";

export class RunController {
  private readonly abortController = new AbortController();
  private readonly semaphore: Semaphore.Semaphore;
  private readonly callCount = Effect.runSync(Ref.make(0));
  private readonly tasks = new Set<Promise<unknown>>();
  private sealed = false;
  private parent?: { signal: AbortSignal; listener: () => void };

  constructor(parentSignal?: AbortSignal, concurrency = MAX_CONCURRENCY) {
    const limit = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(concurrency)));
    this.semaphore = Effect.runSync(Semaphore.make(limit));
    if (parentSignal) {
      const listener = () => this.abort("Parent operation was aborted");
      this.parent = { signal: parentSignal, listener };
      if (parentSignal.aborted) listener();
      else parentSignal.addEventListener("abort", listener, { once: true });
    }
  }

  get signal() {
    return this.abortController.signal;
  }

  get calls() {
    return Effect.runSync(Ref.get(this.callCount));
  }

  schedule<T>(task: (signal: AbortSignal) => Promise<T>, invocation?: AbortSignal) {
    if (this.sealed) return Promise.reject(new Error("Workflow is settling"));
    if (this.signal.aborted) return Promise.reject(abortError(this.signal));
    const reserved = reserveCall(this.callCount);
    if (!reserved) {
      return Promise.reject(
        new Error(`Workflow exceeded the limit of ${MAX_AGENT_CALLS} agent calls`),
      );
    }
    const abort = new AbortController();
    const onRunAbort = () => abort.abort(this.signal.reason);
    const onInvocationAbort = () => abort.abort(invocation?.reason);
    this.signal.addEventListener("abort", onRunAbort, { once: true });
    invocation?.addEventListener("abort", onInvocationAbort, { once: true });
    if (this.signal.aborted) onRunAbort();
    else if (invocation?.aborted) onInvocationAbort();
    const running = (async () => {
      let acquired = false;
      try {
        try {
          await Effect.runPromise(this.semaphore.take(1), { signal: abort.signal });
        } catch (cause) {
          if (invocation?.aborted) throw abortError(invocation);
          if (this.signal.aborted) throw abortError(this.signal);
          throw cause;
        }
        acquired = true;
        if (abort.signal.aborted) throw abortError(abort.signal);
        const result = await task(abort.signal);
        if (invocation?.aborted) throw abortError(invocation);
        return result;
      } finally {
        if (acquired) Effect.runSync(this.semaphore.release(1));
        this.signal.removeEventListener("abort", onRunAbort);
        invocation?.removeEventListener("abort", onInvocationAbort);
      }
    })();
    this.tasks.add(running);
    void running.finally(() => this.tasks.delete(running)).catch(() => {});
    return running;
  }

  abort(reason = "Workflow was aborted") {
    if (!this.signal.aborted) this.abortController.abort(new Error(reason));
  }

  async settle(options: { abort?: boolean; timeoutMs?: number } = {}) {
    this.sealed = true;
    if (options.abort) this.abort();
    const tasks = [...this.tasks];
    if (!tasks.length) return this.detach(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), options.timeoutMs ?? RUN_SHUTDOWN_TIMEOUT_MS);
      timer.unref?.();
    });
    const done = await Promise.race([Promise.allSettled(tasks).then(() => true as const), timeout]);
    if (timer) clearTimeout(timer);
    return this.detach(done);
  }

  private detach<T>(result: T) {
    if (this.parent) this.parent.signal.removeEventListener("abort", this.parent.listener);
    this.parent = undefined;
    return result;
  }
}
