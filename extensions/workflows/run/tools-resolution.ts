import type { AgentCallOptions } from "./input.ts";

const TOOL_MODES = ["read-only"] as const;

/**
 * `read-only` removes write/edit and puts bash behind the command policy. The
 * default (unset) keeps the full built-in tool set, unchanged from upstream.
 */
export function resolveTools(options: AgentCallOptions): { readOnly: boolean; error?: string } {
  if (options.tools === undefined) return { readOnly: false };
  const value = String(options.tools);
  if (!(TOOL_MODES as readonly string[]).includes(value)) {
    return { readOnly: false, error: `invalid tools "${value}" (use ${TOOL_MODES.join("|")})` };
  }
  return { readOnly: true };
}

/**
 * A write scope fences `write`/`edit` to a set of globs.
 *
 * Rejected alongside `tools: "read-only"`, which removes those tools outright and
 * would leave the scope with nothing to fence.
 */
export function resolveWriteScope(
  options: AgentCallOptions,
  readOnly: boolean,
): { writeScope?: string[]; error?: string } {
  if (options.writeScope === undefined) return {};
  if (readOnly) {
    return {
      error: '`writeScope` is redundant with `tools: "read-only"`, which removes write/edit',
    };
  }
  const value = options.writeScope;
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
  if (!valid) return { error: "`writeScope` must be a non-empty array of path globs" };
  return { writeScope: (value as string[]).map((item) => item.trim()) };
}

/**
 * Widen the policy-governed command baseline for verification gates.
 *
 * Rejected unless bash is actually governed (read-only or write-scoped agents),
 * because otherwise bash is unrestricted and the option would be silently
 * ineffective — the same failure class as a silently dropped option key.
 */
export function resolveAllowCommands(
  options: AgentCallOptions,
  governed: boolean,
): { allowCommands?: string[]; error?: string } {
  if (options.allowCommands === undefined) return {};
  if (!governed) {
    return {
      error:
        '`allowCommands` requires exactly one of `tools: "read-only"` or `writeScope` ' +
        "(they are mutually exclusive)",
    };
  }
  const value = options.allowCommands;
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
  if (!valid) {
    return { error: "`allowCommands` must be a non-empty array of command patterns" };
  }
  return { allowCommands: (value as string[]).map((item) => item.trim()) };
}
