import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { formatElapsed, formatUsage } from "../../run/format.ts";
import { isSkippedPhase, phaseGroups } from "../../run/groups.ts";
import { countStates } from "../../run/usage.ts";
import { agentArtifactSummaries } from "../agent-artifacts.ts";
import { agentContext, stateSquare, statusColor, statusWord } from "../theme.ts";
import type { DashboardState } from "./state.ts";
import { selectionWindow } from "./window.ts";

function pad(value: string, width: number) {
  const truncated = truncateToWidth(value, width);
  return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
}

export function renderDetail(state: DashboardState, width: number, height: number) {
  const details = state.current!.details;
  const groups = phaseGroups(details, true);
  const selected = groups[state.phaseIndex];
  const counts = countStates(details);
  const theme = state.theme;
  const title = theme.fg("accent", theme.bold(details.name ?? details.runId));
  const status = theme.fg(statusColor(details.status), statusWord(details.status));
  const lines = [
    truncateToWidth(
      `${title} ${theme.fg("dim", `${counts.done + counts.failed}/${details.agents.length} agents · `)}${status}`,
      width,
    ),
  ];
  if (details.description) lines.push(truncateToWidth(theme.fg("dim", details.description), width));
  const paneHeight = Math.max(1, height - lines.length - 1);
  const leftWidth = Math.max(20, Math.min(34, Math.floor(width * 0.35)));
  const rightWidth = Math.max(10, width - leftWidth - 3);
  const phaseWindow = selectionWindow(groups, state.phaseIndex, paneHeight);
  const left = phaseWindow.items.map((group, relative) => {
    const index = phaseWindow.offset + relative;
    const settled = group.agents.filter((agent) => agent.state !== "running").length;
    const cursor = index === state.phaseIndex && state.focus === "phases" ? "❯" : " ";
    const count = isSkippedPhase(group)
      ? theme.fg("dim", "skipped")
      : `${settled}/${group.agents.length}`;
    return `${cursor} ${group.title} ${count}`;
  });
  const agents = selected?.agents ?? [];
  const agentWindow = selectionWindow(agents, state.agentIndex, Math.floor(paneHeight / 3));
  const right = agentWindow.items.flatMap((agent, relative) => {
    const index = agentWindow.offset + relative;
    const cursor = index === state.agentIndex && state.focus === "agents" ? "❯" : " ";
    const usage = formatUsage(agent.usage, agent.model);
    const stats = [agentContext(agent), formatElapsed(agent.startedAt, agent.finishedAt)]
      .filter(Boolean)
      .join(" · ");
    return [
      `${cursor} ${stateSquare(agent, theme)} ${agent.label}`,
      `    ${[usage, stats].filter(Boolean).join(" · ")}`,
      ...(agent.error ? [`    ${theme.fg("error", agent.error)}`] : []),
      ...(agent.deliveryError
        ? [`    ${theme.fg("dim", `delivery failed after result: ${agent.deliveryError}`)}`]
        : []),
      ...(agent.deniedCommands?.length
        ? [`    ${theme.fg("dim", `denied: ${agent.deniedCommands.join(", ")}`)}`]
        : []),
      // Include every artifact that landed, even when the agent then failed.
      ...agentArtifactSummaries(agent, true).map((artifact) => `    ${theme.fg("dim", artifact)}`),
    ];
  });
  for (let index = 0; index < paneHeight; index++) {
    const lhs = pad(left[index] ?? "", leftWidth);
    const rhs = truncateToWidth(right[index] ?? "", rightWidth);
    lines.push(`${lhs}${theme.fg("dim", " │ ")}${rhs}`);
  }
  while (lines.length < height - 1) lines.push("");
  const footer = state.notice
    ? theme.fg("success", state.notice)
    : details.error
      ? theme.fg("error", `Error: ${details.error}`)
      : theme.fg(
          "dim",
          "j/k select · g/G ends · h/l panel · enter transcript · s report · esc back",
        );
  lines.push(footer);
  return lines.slice(0, height).map((line) => truncateToWidth(line, width));
}
