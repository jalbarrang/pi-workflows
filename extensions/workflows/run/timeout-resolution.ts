import type { AgentCallOptions } from "./input.ts";
import { MAX_TOOL_TIMEOUT_MS, TOOL_TIMEOUT_MS } from "./limits.ts";

/**
 * Per-agent tool-call timeout. Build-heavy repos need more than the 3 minute
 * default (a single `dotnet build` or typecheck can take minutes), but an
 * unbounded value would turn a hung tool into a hung run, so overrides are
 * capped. Rejects rather than clamps: a silently lowered timeout is the same
 * class of bug as a silently ignored option key.
 */
export function resolveToolTimeout(options: AgentCallOptions): {
  timeoutMs?: number;
  error?: string;
} {
  const value = options.toolTimeoutMs;
  if (value === undefined) return { timeoutMs: TOOL_TIMEOUT_MS };
  const valid = typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!valid || value > MAX_TOOL_TIMEOUT_MS) {
    return {
      error: `invalid toolTimeoutMs "${String(value)}" (use a positive integer <= ${MAX_TOOL_TIMEOUT_MS})`,
    };
  }
  return { timeoutMs: value };
}
