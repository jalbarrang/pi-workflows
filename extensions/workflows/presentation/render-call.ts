import { Text } from "@earendil-works/pi-tui";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { extractMeta } from "../scripting/index.ts";
import { SQUARE } from "./theme.ts";

type Theme = ExtensionContext["ui"]["theme"];
export function renderWorkflowCall(args: { script?: string; background?: boolean }, theme: Theme) {
  const meta = extractMeta(args.script ?? "");
  let text =
    theme.fg("toolTitle", theme.bold("workflow ")) + theme.fg("accent", meta.name ?? "(script)");
  if (args.background) text += theme.fg("dim", " (background)");
  if (meta.description) text += `\n  ${theme.fg("dim", meta.description)}`;
  for (const phase of meta.phases.slice(0, 8)) {
    text += `\n  ${theme.fg("dim", SQUARE)} ${theme.fg("accent", phase.title)}`;
    if (phase.detail) text += theme.fg("dim", ` — ${phase.detail}`);
  }
  return new Text(text, 0, 0);
}
