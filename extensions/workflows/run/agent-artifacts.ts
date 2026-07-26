import type { AgentOutcome, PersistAgentOutput } from "../agent/index.ts";
import { writeAgentArtifacts } from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";
import type { ScriptAgentResult } from "./input.ts";
import type { AgentRecord } from "./types.ts";

/** The artifact fields shared by the persisted record and the script-visible result. */
export type AgentArtifactFields = Pick<
  ScriptAgentResult,
  "outputFile" | "structuredFile" | "outputBytes" | "outputTruncated"
>;

/**
 * Bind the artifact writer to one agent's slot in this run's directory.
 *
 * The runner calls this while it still holds the untruncated answer, which is
 * the whole point: the failure being closed — run `wf_2cf06cc43747` — lost four
 * completed agents because nothing durable was written between their success and
 * the sandbox's death.
 *
 * An empty answer with no structured payload is the only case worth skipping.
 */
export function createOutputPersister(runDir: string, record: AgentRecord): PersistAgentOutput {
  return (payload) => {
    if (!payload.output && payload.structured === undefined) return undefined;
    return writeAgentArtifacts(runDir, record, payload);
  };
}

/** Lift the artifact fields off a finished outcome, dropping the absent ones. */
export function artifactFields(outcome: AgentOutcome): AgentArtifactFields {
  return compact({
    outputFile: outcome.outputFile,
    structuredFile: outcome.structuredFile,
    outputBytes: outcome.outputBytes,
    outputTruncated: outcome.outputTruncated,
  });
}
