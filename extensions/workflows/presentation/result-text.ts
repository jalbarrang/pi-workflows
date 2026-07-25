import * as os from "node:os";
import type { WorkflowDetails } from "../run/types.ts";
import { countStates } from "../run/usage.ts";
import { formatElapsed } from "../run/format.ts";
import { resultJson } from "./result-value.ts";

export const shortenHome = (value: string) => {
  const home = os.homedir();
  return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
};
export function buildWorkflowResultMessage(details: WorkflowDetails, runDir: string) {
  const { done, failed } = countStates(details);
  const elapsed = formatElapsed(details.startedAt, details.finishedAt);
  const lines = [
    `Workflow ${details.name ? `"${details.name}"` : details.runId} ${details.status} — ` +
      `${done}/${details.agents.length} agents ok${failed ? `, ${failed} failed` : ""} ` +
      `across ${details.phases.length} phase(s) in ${elapsed}.`,
    `Run dir: ${shortenHome(runDir)}`,
    ...(details.resumedFrom ? [`Resumed from: ${details.resumedFrom}`] : []),
  ];
  if (details.error) lines.push(`Error: ${details.error}`);
  // Independent of the script's return value: a declared phase that produced
  // nothing must not be readable as a phase that ran clean.
  if (details.incompletePhases?.length) {
    lines.push(`Incomplete phases (no successful agent): ${details.incompletePhases.join(", ")}`);
  }
  if (details.agents.length) {
    lines.push("", "Agents:");
    for (const agent of details.agents) {
      // A best-effort agent that failed is not a fault to chase; naming it as one
      // costs the reader the same attention as a real failure.
      const failed = agent.optional ? "failed (optional)" : "FAILED";
      const state = agent.state === "done" ? "ok" : agent.state === "error" ? failed : "running";
      const phase = agent.phase ? ` (${agent.phase})` : "";
      const note =
        agent.error ?? (agent.deliveryError && `delivery failed: ${agent.deliveryError}`);
      lines.push(`- [${agent.label}]${phase} ${state}${note ? ` — ${note}` : ""}`);
      // A blocked agent frequently reports success having changed nothing.
      if (agent.deniedCommands?.length) {
        lines.push(`  denied commands: ${agent.deniedCommands.join(", ")}`);
      }
    }
  }
  if (details.result !== undefined) lines.push("", "Result:", resultJson(details.result));
  return lines.join("\n");
}
export function backgroundFollowUp(details: WorkflowDetails, runDir: string) {
  return `[Background workflow ${details.runId} ${details.status}]\n\n${buildWorkflowResultMessage(details, runDir)}`;
}
export function backgroundLaunch(details: WorkflowDetails, runDir: string) {
  return [
    `Workflow ${details.name ? `"${details.name}"` : details.runId} launched in background.`,
    `Artifacts: ${shortenHome(runDir)}`,
    "A follow-up will arrive when it finishes; /workflows shows progress.",
  ].join("\n");
}
