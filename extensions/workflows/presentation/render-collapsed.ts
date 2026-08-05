import { keyHint, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { formatElapsed } from "../run/format.ts";
import type { WorkflowDetails } from "../run/types.ts";
import { totalUsage } from "../run/format.ts";
import { agentContext, stateSquare } from "./theme.ts";
import { renderHeader } from "./render-header.ts";

type Theme = ExtensionContext["ui"]["theme"];
export function renderCollapsed(details: WorkflowDetails, theme: Theme, previous?: Component) {
  let text = renderHeader(details, theme);
  for (const agent of details.agents) {
    const context = agentContext(agent);
    const phase = agent.phase ? theme.fg("dim", ` (${agent.phase})`) : "";
    const duration = formatElapsed(agent.startedAt, agent.finishedAt);
    text += `\n  ${stateSquare(agent, theme)} ${theme.fg("accent", agent.label)}${phase}`;
    text += theme.fg("dim", `${context ? ` · ${context}` : ""} · ${duration}`);
  }
  const totals = totalUsage(details);
  if (totals) text += `\n  ${theme.fg("dim", `Total: ${totals}`)}`;
  if (details.error) text += `\n  ${theme.fg("error", `Error: ${details.error}`)}`;
  text += `\n${theme.fg("muted", `(${keyHint("app.tools.expand", "to expand")})`)}`;
  const component = previous instanceof Text ? previous : new Text("", 0, 0);
  component.setText(text);
  return component;
}
