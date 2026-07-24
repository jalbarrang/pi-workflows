/**
 * Single source of truth for the option keys `agent()` accepts.
 *
 * Every layer derives from this list: the sandbox IPC filter picks these keys,
 * `AgentCallOptions` is a mapped type over them, and the rejection message
 * quotes them. Adding a DSL option means editing this list and nothing else.
 */
export const AGENT_OPTION_KEYS = [
  "label",
  "phase",
  "schema",
  "model",
  "provider",
  "effort",
  "toolTimeoutMs",
  "tools",
  "allowCommands",
  "writeScope",
  "required",
] as const;

export type AgentOptionKey = (typeof AGENT_OPTION_KEYS)[number];

/**
 * Unknown keys are a misconfiguration, not a value error: silently dropping
 * them lets a typo like `thinking` instead of `effort` inherit a default for a
 * whole run. Name every offender and the valid set in one message.
 */
export function unknownOptionKeyError(label: string, keys: readonly string[]) {
  const plural = keys.length > 1 ? "s" : "";
  const listed = keys.map((key) => `"${key}"`).join(", ");
  return `agent "${label}": unknown option key${plural} ${listed} (valid: ${AGENT_OPTION_KEYS.join("|")})`;
}
