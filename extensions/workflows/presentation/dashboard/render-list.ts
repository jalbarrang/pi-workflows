import { truncateToWidth } from "@earendil-works/pi-tui";
import { countStates } from "../../run/usage.ts";
import { formatElapsed } from "../../run/format.ts";
import { statusColor, statusWord } from "../theme.ts";
import type { DashboardState } from "./state.ts";
import { selectionWindow } from "./window.ts";

export function renderRunList(state: DashboardState, width: number, height: number) {
  const theme = state.theme;
  const lines = [theme.fg("accent", theme.bold("Workflows")), theme.fg("dim", "session runs")];
  if (!state.entries.length) lines.push("", theme.fg("muted", "No workflow runs yet."));
  const capacity = Math.max(1, Math.floor((height - 3) / 2));
  const window = selectionWindow(state.entries, state.listIndex, capacity);
  for (let relative = 0; relative < window.items.length; relative++) {
    const index = window.offset + relative;
    const entry = window.items[relative];
    const details = entry.details;
    const counts = countStates(details);
    const selected = index === state.listIndex;
    const prefix = selected ? theme.fg("accent", "❯ ") : "  ";
    const live = entry.live ? theme.fg("warning", "● ") : "  ";
    const label = details.name ?? details.runId;
    const status = theme.fg(statusColor(details.status), statusWord(details.status));
    lines.push(
      truncateToWidth(
        `${prefix}${live}${theme.fg("accent", label)} ${theme.fg("dim", details.runId)}`,
        width,
      ),
    );
    lines.push(
      truncateToWidth(
        `    ${counts.done + counts.failed}/${details.agents.length} agents · ` +
          `${formatElapsed(details.startedAt, details.finishedAt)} · ${status}`,
        width,
      ),
    );
  }
  while (lines.length < height - 1) lines.push("");
  const range = state.entries.length
    ? `${window.offset + 1}-${window.offset + window.items.length}/${state.entries.length}`
    : "0/0";
  lines.push(theme.fg("dim", `j/k select · g/G ends · enter detail · esc close · ${range}`));
  return lines.slice(0, height).map((line) => truncateToWidth(line, width));
}
