export const CHILD_EXCLUDED_TOOL_NAMES = [
  "subagent",
  "subagent_spawn",
  "subagent_wait",
  "subagent_cancel",
  "subagent_check",
  "subagent_list",
  "workflow",
  "ask_user",
] as const;

/** Tools a read-only agent must not have at all. Bash is policy-wrapped, not excluded. */
export const READ_ONLY_EXCLUDED_TOOL_NAMES = ["write", "edit"] as const;

export function childToolPolicy(readOnly = false) {
  return {
    excludeTools: [
      ...CHILD_EXCLUDED_TOOL_NAMES,
      ...(readOnly ? READ_ONLY_EXCLUDED_TOOL_NAMES : []),
    ],
  };
}
