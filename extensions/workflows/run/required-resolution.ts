import type { AgentCallOptions } from "./input.ts";

/**
 * `required: true` marks an agent as a gate: if it fails, the run stops.
 *
 * `agent()` resolving `{ ok: false }` is the right default for fan-out, where one
 * scout dying should not kill the run. It is the wrong default for a gate, where
 * the entire point is that nothing proceeds until the check passes — and the
 * terse way to consume a gate (`(findings && findings.blocking) || []`) turns a
 * dead reviewer into a clean review. This option moves that guarantee out of the
 * script author's memory and into the engine.
 *
 * Booleans only: a truthy string would otherwise silently arm or disarm a gate.
 */
export function resolveRequired(options: AgentCallOptions): {
  required: boolean;
  error?: string;
} {
  const value = options.required;
  if (value === undefined) return { required: false };
  if (typeof value !== "boolean") {
    return { required: false, error: `invalid required "${String(value)}" (use true|false)` };
  }
  return { required: value };
}

/** True when a call is armed as a gate, even if its options never resolved. */
export function isRequestedGate(options: AgentCallOptions) {
  return options.required === true;
}

/**
 * Status a run must report once a gate has failed.
 *
 * A gate failure unwinds two ways: the abort kills the sandbox (which would read
 * as a cancellation) or the script reaches its `return` first (which would read
 * as a clean completion). Both are failures of the run.
 */
export function gateStatus<Status extends string>(status: Status, requiredFailure?: string) {
  return requiredFailure ? ("failed" as const) : status;
}
