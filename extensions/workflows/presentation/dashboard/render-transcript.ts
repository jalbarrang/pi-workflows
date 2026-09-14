import { truncateToWidth } from "@earendil-works/pi-tui";
import { formatElapsed } from "../../run/format.ts";
import { agentContext, stateSquare } from "../theme.ts";
import { transcriptRows } from "./render-entries.ts";
import type { DashboardState } from "./state.ts";
import { selectedAgent } from "./state.ts";

export function renderTranscript(state: DashboardState, width: number, height: number) {
  const agent = selectedAgent(state)!;
  const details = state.current!.details;
  const theme = state.theme;
  const rows = agent.transcript.length
    ? transcriptRows(agent.transcript, width, theme)
    : [theme.fg("muted", "Transcript unavailable.")];
  const bodyHeight = Math.max(1, height - 3);
  state.transcriptRows = rows.length;
  state.viewport = bodyHeight;
  state.scroll = Math.min(state.scroll, Math.max(0, rows.length - bodyHeight));
  const visible = rows.slice(state.scroll, state.scroll + bodyHeight);
  const stats = [agent.model, agentContext(agent), formatElapsed(agent.startedAt, agent.finishedAt)]
    .filter(Boolean)
    .join(" · ");
  const title = `${stateSquare(agent, theme)} ${theme.bold(agent.label)}${stats ? ` · ${stats}` : ""}`;
  const end = Math.min(rows.length, state.scroll + bodyHeight);
  const position = rows.length > bodyHeight ? ` · ${state.scroll + 1}-${end}/${rows.length}` : "";
  const context = `${details.name ?? details.runId} · ${agent.phase ?? "unphased"} · ${agent.transcript.length} entries${position}`;
  const lines = [theme.fg("accent", title), theme.fg("muted", context), ...visible];
  while (lines.length < height - 1) lines.push("");
  lines.push(theme.fg("dim", "j/k scroll · ctrl-u/d page · g/G ends · esc back"));
  return lines.slice(0, height).map((line) => truncateToWidth(line, width));
}
