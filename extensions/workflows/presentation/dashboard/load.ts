import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { WorkflowDetails } from "../../run/types.ts";
import { normalizeDetails } from "./details.ts";
import { normalizeTranscript } from "./normalize.ts";

export interface RunEntry {
  runId: string;
  details: WorkflowDetails;
  live: boolean;
}
export const runsDir = () => path.join(getAgentDir(), "workflows");
function hydrateArtifacts(runDir: string, details: WorkflowDetails) {
  if (details.resultArtifact) {
    try {
      details.result = JSON.parse(
        fs.readFileSync(path.join(runDir, path.basename(details.resultArtifact)), "utf8"),
      );
    } catch {}
  }
  if (details.transcriptArtifact) {
    try {
      const value = JSON.parse(
        fs.readFileSync(path.join(runDir, path.basename(details.transcriptArtifact)), "utf8"),
      ) as Record<string, unknown>;
      for (const agent of details.agents) {
        agent.transcript = normalizeTranscript(value[String(agent.index)]);
      }
    } catch {}
  }
}
function markStale(details: WorkflowDetails) {
  if (details.status !== "running") return;
  details.status = "aborted";
  details.finishedAt ??= Date.now();
  details.error ??= "Recovered stale run that was not active";
  for (const agent of details.agents) {
    if (agent.state !== "running") continue;
    agent.state = "error";
    agent.error ??= "Run ended before this agent settled";
    agent.finishedAt = details.finishedAt;
  }
}
export function loadRunEntries(
  active: ReadonlyMap<string, WorkflowDetails>,
  sessionId: string,
  referenced: ReadonlySet<string>,
) {
  let names: string[] = [];
  try {
    names = fs.readdirSync(runsDir()).filter((name) => name.startsWith("wf_"));
  } catch {}
  const ids = new Set([...names, ...active.keys()]);
  const entries: RunEntry[] = [];
  for (const runId of ids) {
    const live = active.get(runId);
    if (live) {
      entries.push({ runId, details: live, live: true });
      continue;
    }
    try {
      const runDir = path.join(runsDir(), runId);
      const raw = JSON.parse(fs.readFileSync(path.join(runDir, "workflow.json"), "utf8"));
      const details = normalizeDetails(runId, raw);
      if (!details || (details.sessionId !== sessionId && !referenced.has(runId))) continue;
      hydrateArtifacts(runDir, details);
      markStale(details);
      entries.push({ runId, details, live: false });
    } catch {}
  }
  return entries.sort((left, right) => right.details.startedAt - left.details.startedAt);
}
