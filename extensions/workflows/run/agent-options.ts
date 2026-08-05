import type { ThinkingLevel, WorkflowModel } from "../agent/index.ts";
import { compact } from "../shared/compact.ts";
import type { AgentCallOptions } from "./input.ts";
import { resolveAgentDuration } from "./duration-resolution.ts";
import { TOOL_TIMEOUT_MS } from "./limits.ts";
import { resolveEffort, resolveModel, type ModelResolutionContext } from "./model-resolution.ts";
import { resolveOptional } from "./optional-resolution.ts";
import { resolveRequired } from "./required-resolution.ts";
import { resolveToolTimeout } from "./timeout-resolution.ts";

export interface ResolvedAgentOptions {
  model?: WorkflowModel;
  thinkingLevel: ThinkingLevel;
  toolCallTimeoutMs: number;
  maxDurationMs?: number;
  /** Failure of this agent aborts the whole run instead of resolving `ok: false`. */
  required: boolean;
  /** Failure of this agent is expected, so it never counts as an incomplete phase. */
  optional: boolean;
}

/**
 * Validate every `agent()` option in one place, before the call is scheduled.
 *
 * Running ahead of scheduling means a misconfigured call consumes neither a
 * concurrency permit nor a unit of the run's 32-call budget, and the script sees
 * the same `{ ok: false, error }` shape it sees for any other failure.
 */
export function resolveAgentOptions(
  options: AgentCallOptions,
  context: ModelResolutionContext,
  inherited: ThinkingLevel,
): { resolved?: ResolvedAgentOptions; error?: string } {
  const model = resolveModel(options, context);
  if (model.error) return { error: model.error };
  const effort = resolveEffort(options, inherited);
  if (effort.error) return { error: effort.error };
  const timeout = resolveToolTimeout(options);
  if (timeout.error) return { error: timeout.error };
  const duration = resolveAgentDuration(options);
  if (duration.error) return { error: duration.error };
  const gate = resolveRequired(options);
  if (gate.error) return { error: gate.error };
  const bestEffort = resolveOptional(options, gate.required);
  if (bestEffort.error) return { error: bestEffort.error };
  return {
    resolved: compact({
      model: model.model,
      thinkingLevel: effort.effort ?? inherited,
      toolCallTimeoutMs: timeout.timeoutMs ?? TOOL_TIMEOUT_MS,
      maxDurationMs: duration.durationMs,
      required: gate.required,
      optional: bestEffort.optional,
    }),
  };
}
