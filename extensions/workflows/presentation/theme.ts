import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentRecord, WorkflowStatus } from "../run/types.ts";

type Theme = ExtensionContext["ui"]["theme"];
export const SQUARE = "■";
export function statusColor(status: WorkflowStatus) {
  if (status === "completed") return "success" as const;
  if (status === "running") return "warning" as const;
  return "error" as const;
}
export function statusWord(status: WorkflowStatus) {
  return status === "completed" ? "done" : status;
}
export function stateSquare(agent: AgentRecord, theme: Theme) {
  const color = agent.state === "done" ? "success" : agent.state === "error" ? "error" : "warning";
  return theme.fg(color, SQUARE);
}
export function agentContext(agent: AgentRecord) {
  const capacity = agent.contextWindow;
  if (!capacity || capacity <= 0) return "";
  const tokens = agent.usage.contextTokens;
  const percent =
    typeof tokens === "number" ? Math.min(100, Math.round((tokens / capacity) * 100)) : "?";
  const compact =
    capacity < 1_000_000
      ? `${Math.round(capacity / 1_000)}k`
      : `${(capacity / 1_000_000).toFixed(1)}M`;
  return `${percent}%/${compact}`;
}
