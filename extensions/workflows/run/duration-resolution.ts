import type { AgentCallOptions } from "./input.ts";
import { MAX_AGENT_DURATION_MS } from "./limits.ts";

/** Bound the whole model loop without imposing a default deadline. */
export function resolveAgentDuration(options: AgentCallOptions): {
  durationMs?: number;
  error?: string;
} {
  const value = options.maxDurationMs;
  if (value === undefined) return {};
  const valid = typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!valid || value > MAX_AGENT_DURATION_MS) {
    return {
      error: `invalid maxDurationMs "${String(value)}" (use a positive integer <= ${MAX_AGENT_DURATION_MS})`,
    };
  }
  return { durationMs: value };
}
