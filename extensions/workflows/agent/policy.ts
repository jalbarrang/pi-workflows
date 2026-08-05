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

export function childToolPolicy() {
  return { excludeTools: [...CHILD_EXCLUDED_TOOL_NAMES] };
}
