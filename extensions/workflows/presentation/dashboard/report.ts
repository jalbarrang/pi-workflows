import * as fs from "node:fs";
import * as path from "node:path";
import { formatElapsed, formatUsage } from "../../run/format.ts";
import { phaseGroups } from "../../run/groups.ts";
import type { WorkflowDetails } from "../../run/types.ts";
import { aggregateUsage, countStates } from "../../run/usage.ts";
import { resultJson } from "../result-value.ts";
import { shortenHome } from "../result-text.ts";
import { agentContext, statusWord } from "../theme.ts";
import { runsDir } from "./load.ts";

export function buildReport(details: WorkflowDetails) {
  const { done, failed } = countStates(details);
  const lines = [
    `# Workflow ${details.name ?? details.runId}`,
    "",
    `- Run: ${details.runId}`,
    `- Status: ${statusWord(details.status)}`,
    `- Agents: ${done}/${details.agents.length} ok${failed ? `, ${failed} failed` : ""}`,
    `- Elapsed: ${formatElapsed(details.startedAt, details.finishedAt)}`,
  ];
  const totals = formatUsage(aggregateUsage(details.agents));
  if (totals) lines.push(`- Usage: ${totals}`);
  if (details.description) lines.push("", details.description);
  if (details.error) lines.push("", `**Error:** ${details.error}`);
  for (const group of phaseGroups(details, true)) {
    lines.push("", `## ${group.title}`, "");
    if (!group.agents.length) lines.push(group.optional ? "_skipped (optional)_" : "_no agents_");
    for (const agent of group.agents) {
      const state = agent.state === "done" ? "ok" : agent.state === "error" ? "FAILED" : "running";
      const stats = [
        agent.model,
        agentContext(agent),
        formatElapsed(agent.startedAt, agent.finishedAt),
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- **${agent.label}** — ${state}${stats ? ` (${stats})` : ""}`);
      if (agent.error) lines.push(`  - error: ${agent.error}`);
    }
  }
  if (details.result !== undefined) {
    lines.push("", "## Result", "", "```json", resultJson(details.result), "```");
  }
  return `${lines.join("\n")}\n`;
}
export function saveReport(details: WorkflowDetails) {
  const target = path.join(runsDir(), details.runId, "report.md");
  fs.writeFileSync(target, buildReport(details), "utf8");
  return `saved ${shortenHome(target)}`;
}
