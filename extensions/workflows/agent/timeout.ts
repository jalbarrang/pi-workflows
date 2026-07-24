import type { AgentSessionEventListener, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { TOOL_TIMEOUT_MS } from "../run/limits.ts";

function formatTimeout(timeoutMs: number) {
  if (timeoutMs % 60_000 === 0) {
    const minutes = timeoutMs / 60_000;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (timeoutMs % 1_000 === 0) {
    const seconds = timeoutMs / 1_000;
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  return `${timeoutMs} ms`;
}

export class ToolCallTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool call "${toolName}" timed out after ${formatTimeout(timeoutMs)}.`);
    this.name = "ToolCallTimeoutError";
  }
}

export function runWithToolCallTimeout<T>(
  toolName: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  execute: (signal: AbortSignal) => Promise<T>,
) {
  const timeoutController = new AbortController();
  const executionSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;
  const error = new ToolCallTimeoutError(toolName, timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timeoutController.abort(error);
      reject(error);
    }, timeoutMs);
  });
  let removeAbortListener: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    if (!signal) return;
    const onAbort = () => {
      const reason = signal.reason;
      reject(reason instanceof Error ? reason : new Error(`Tool call "${toolName}" was aborted.`));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });
  return Promise.race([execute(executionSignal), timeout, aborted]).finally(() => {
    if (timer) clearTimeout(timer);
    removeAbortListener?.();
  });
}

interface ToolRegistry {
  getAllTools(): Array<{ name: string }>;
  getToolDefinition(name: string): ToolDefinition | undefined;
  subscribe(listener: AgentSessionEventListener): () => void;
}
export function guardWorkflowChildTools(session: ToolRegistry, timeoutMs = TOOL_TIMEOUT_MS) {
  const wrapped = new WeakSet<ToolDefinition>();
  const apply = () => {
    for (const tool of session.getAllTools()) {
      const definition = session.getToolDefinition(tool.name);
      if (!definition || wrapped.has(definition)) continue;
      wrapped.add(definition);
      const execute = definition.execute;
      definition.execute = (id, params, signal, update, ctx) =>
        runWithToolCallTimeout(definition.name, timeoutMs, signal, (guarded) =>
          execute.call(definition, id, params, guarded, update, ctx),
        );
    }
  };
  apply();
  return session.subscribe((event) => {
    if (event.type === "agent_start") apply();
  });
}
