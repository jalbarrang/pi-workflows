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
  ];
  if (details.error) lines.push(`Error: ${details.error}`);
  if (details.agents.length) {
    lines.push("", "Agents:");
    for (const agent of details.agents) {
      const state = agent.state === "done" ? "ok" : agent.state === "error" ? "FAILED" : "running";
      const phase = agent.phase ? ` (${agent.phase})` : "";
      lines.push(`- [${agent.label}]${phase} ${state}${agent.error ? ` — ${agent.error}` : ""}`);
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
