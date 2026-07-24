import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { formatElapsed } from "../run/format.ts";
import type { WorkflowDetails } from "../run/types.ts";
import { countStates } from "../run/usage.ts";
import { SQUARE, statusColor, statusWord } from "./theme.ts";

type Theme = ExtensionContext["ui"]["theme"];
export function renderHeader(details: WorkflowDetails, theme: Theme) {
  const { done, failed } = countStates(details);
  const color = statusColor(details.status);
  let text =
    `${theme.fg(color, SQUARE)} ${theme.fg("toolTitle", theme.bold("workflow "))}` +
    `${theme.fg("accent", details.name ?? details.runId)} ` +
    theme.fg(
      "dim",
      `${done + failed}/${details.agents.length} agents · ` +
        `${formatElapsed(details.startedAt, details.finishedAt)} · `,
    ) +
    theme.fg(color, statusWord(details.status));
  if (failed) text += theme.fg("error", ` · ${failed} failed`);
  if (details.background) text += theme.fg("dim", " (background)");
  if (details.status === "running" && details.currentPhase) {
    text += theme.fg("muted", ` · ${details.currentPhase}`);
  }
  return text;
}
