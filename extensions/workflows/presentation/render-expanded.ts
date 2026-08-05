import { getMarkdownTheme, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { formatElapsed, formatUsage, totalUsage } from "../run/format.ts";
import { isSkippedPhase, phaseGroups } from "../run/groups.ts";
import type { WorkflowDetails } from "../run/types.ts";
import { renderHeader } from "./render-header.ts";
import { resultJson } from "./result-value.ts";
import { agentContext, stateSquare } from "./theme.ts";

type Theme = ExtensionContext["ui"]["theme"];
export function renderExpanded(details: WorkflowDetails, theme: Theme, previous?: Component) {
  const container = previous instanceof Container ? previous : new Container();
  container.clear();
  container.addChild(new Text(renderHeader(details, theme), 0, 0));
  if (details.description) container.addChild(new Text(theme.fg("dim", details.description), 0, 0));
  // includeEmpty is on so declared-but-conditional phases can report as skipped;
  // non-optional empty phases stay hidden exactly as before.
  for (const group of phaseGroups(details, true)) {
    if (!group.agents.length && !group.optional) continue;
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("muted", `─── ${group.title} ───`), 0, 0));
    if (isSkippedPhase(group)) {
      container.addChild(new Text(`  ${theme.fg("dim", "skipped (optional)")}`, 0, 0));
      continue;
    }
    for (const agent of group.agents) {
      const stats = [agentContext(agent), formatElapsed(agent.startedAt, agent.finishedAt)]
        .filter(Boolean)
        .join(" · ");
      let line = `${stateSquare(agent, theme)} ${theme.fg("accent", agent.label)} `;
      line += theme.fg("dim", stats);
      const usage = formatUsage(agent.usage, agent.model);
      if (usage) line += ` ${theme.fg("dim", usage)}`;
      container.addChild(new Text(line, 0, 0));
      const note = agent.error ?? agent.preview.split("\n").slice(0, 2).join(" ");
      if (note)
        container.addChild(new Text(`  ${theme.fg(agent.error ? "error" : "dim", note)}`, 0, 0));
    }
  }
  if (details.error) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("error", `Error: ${details.error}`), 0, 0));
  }
  if (details.result !== undefined) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("muted", "─── result ───"), 0, 0));
    container.addChild(
      new Markdown(`\`\`\`json\n${resultJson(details.result)}\n\`\`\``, 0, 0, getMarkdownTheme()),
    );
  }
  const totals = totalUsage(details);
  if (totals) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", `Total: ${totals}`), 0, 0));
  }
  return container;
}
