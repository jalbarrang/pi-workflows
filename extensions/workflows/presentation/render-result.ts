import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { WorkflowDetails } from "../run/types.ts";
import { renderCollapsed } from "./render-collapsed.ts";
import { renderExpanded } from "./render-expanded.ts";

type Theme = ExtensionContext["ui"]["theme"];
interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  details?: unknown;
}
export function renderWorkflowResult(result: ToolResult, expanded: boolean, theme: Theme) {
  const details = result.details as WorkflowDetails | undefined;
  if (!details) {
    const first = result.content[0];
    return new Text(first?.type === "text" ? (first.text ?? "") : "(no output)", 0, 0);
  }
  return expanded ? renderExpanded(details, theme) : renderCollapsed(details, theme);
}
