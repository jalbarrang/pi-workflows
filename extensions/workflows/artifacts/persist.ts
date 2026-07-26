import * as path from "node:path";
import type { WorkflowDetails } from "../run/types.ts";
import { compact } from "../shared/compact.ts";
import { writeFileAtomic } from "./atomic.ts";
import { safeStringify } from "./stringify.ts";
import { boundedArtifactTranscript } from "./transcript.ts";

function writeRunFile(runDir: string, name: string, content: string) {
  writeFileAtomic(path.join(runDir, name), content);
}

export function persistWorkflowJson(runDir: string, details: WorkflowDetails) {
  const transcripts = Object.fromEntries(
    details.agents.map((agent) => [agent.index, boundedArtifactTranscript(agent.transcript)]),
  );
  writeRunFile(
    runDir,
    "transcripts.json",
    safeStringify(transcripts, { maxBytes: 2 * 1024 * 1024 }),
  );
  if (details.result !== undefined) {
    writeRunFile(runDir, "result.json", safeStringify(details.result, { maxBytes: 1024 * 1024 }));
  }
  const stored = details.result !== undefined;
  const summary: WorkflowDetails = compact({
    ...details,
    result: stored ? "[stored in result.json]" : undefined,
    resultArtifact: stored ? "result.json" : undefined,
    transcriptArtifact: "transcripts.json",
    agents: details.agents.map((agent) => ({ ...agent, transcript: [] })),
  });
  writeRunFile(runDir, "workflow.json", safeStringify(summary, { maxBytes: 1024 * 1024 }));
}
