import { type Component, Text } from "@earendil-works/pi-tui";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { extractMeta, type WorkflowMeta } from "../scripting/index.ts";

type Theme = ExtensionContext["ui"]["theme"];
export function renderWorkflowCall(
  args: { script?: string },
  theme: Theme,
  previous?: Component,
  argsComplete = true,
) {
  const meta: WorkflowMeta = argsComplete ? extractMeta(args.script ?? "") : { phases: [] };
  let text =
    theme.fg("toolTitle", theme.bold("workflow ")) + theme.fg("accent", meta.name ?? "(script)");
  if (meta.description) text += `\n  ${theme.fg("dim", meta.description)}`;
  const component = previous instanceof Text ? previous : new Text("", 0, 0);
  component.setText(text);
  return component;
}
