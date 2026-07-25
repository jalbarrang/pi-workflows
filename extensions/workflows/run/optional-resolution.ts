import type { AgentCallOptions } from "./input.ts";

/**
 * `optional: true` marks an agent as best-effort: its failure is not a hole.
 *
 * `incompletePhases` exists so a phase that produced nothing cannot read as a
 * phase that ran clean, and that is the right default. But some calls are
 * deliberately speculative — a second opinion, an alternate implementer tried
 * before a fallback, a nice-to-have doc pass — and reporting their absence as an
 * incomplete phase trains a reader to ignore the one field that is supposed to
 * be alarming. This option says the emptiness was intended.
 *
 * It is the opposite end of the same axis as `required`, so arming both is a
 * contradiction rather than a precedence question: rejected, not resolved.
 */
export function resolveOptional(
  options: AgentCallOptions,
  required: boolean,
): { optional: boolean; error?: string } {
  const value = options.optional;
  if (value === undefined) return { optional: false };
  if (typeof value !== "boolean") {
    return { optional: false, error: `invalid optional "${String(value)}" (use true|false)` };
  }
  if (value && required) {
    return {
      optional: false,
      error: "optional and required cannot both be true (a gate cannot be best-effort)",
    };
  }
  return { optional: value };
}
