import * as path from "node:path";
import { agentSlug } from "./agent-slug.ts";
import { writeFileAtomic } from "./atomic.ts";
import { AGENT_ARTIFACT_MAX_BYTES, AGENT_ARTIFACT_MAX_NODES } from "./limits.ts";
import { safeStringify } from "./stringify.ts";
import { truncateUtf8 } from "./utf8.ts";

export interface AgentArtifactPaths {
  /** Absolute path to the agent's full output, free of the inline IPC cap. */
  outputFile: string;
  structuredFile?: string;
  outputBytes: number;
}

export interface AgentArtifactPayload {
  output: string;
  structured?: unknown;
}

/**
 * Write one agent's answer to disk at full fidelity, the moment it exists.
 *
 * Everything else that carries an agent's output is bounded for a reason: the IPC
 * result is capped so a child cannot flood the host, and the transcript is capped
 * so an artifact file stays readable. Those caps are correct and stay. What was
 * missing is a channel with no downstream consumer to protect — a file — so an
 * answer survives the run that produced it.
 *
 * Observed in run `wf_2cf06cc43747`: four read-only recon agents finished after
 * 11 minutes, the script then built an oversized synthesis prompt, the sandbox
 * died, and the only surviving copies of the four reports were transcript entries
 * already collapsed to `{"truncated": true, "reason": "serialized value exceeded
 * 16384 bytes"}`. The work was complete and paid for, and it was unrecoverable.
 *
 * Returns `undefined` rather than throwing: an artifact is a convenience for the
 * next agent, never a reason to fail an agent that already succeeded.
 */
export function writeAgentArtifacts(
  runDir: string,
  agent: { index: number; label: string },
  payload: AgentArtifactPayload,
): AgentArtifactPaths | undefined {
  try {
    const directory = path.join(runDir, "agents", `${agent.index}-${agentSlug(agent.label)}`);
    const outputFile = path.join(directory, "output.md");
    const output = truncateUtf8(payload.output, AGENT_ARTIFACT_MAX_BYTES);
    writeFileAtomic(outputFile, output);
    const result: AgentArtifactPaths = {
      outputFile,
      outputBytes: Buffer.byteLength(output),
    };
    if (payload.structured === undefined) return result;
    const structuredFile = path.join(directory, "structured.json");
    // The nested caps are widened alongside the byte cap on purpose: a default
    // 64KB string cap would re-truncate exactly the verbatim-evidence fields this
    // file exists to preserve.
    writeFileAtomic(
      structuredFile,
      safeStringify(payload.structured, {
        maxBytes: AGENT_ARTIFACT_MAX_BYTES,
        maxStringBytes: AGENT_ARTIFACT_MAX_BYTES,
        maxNodes: AGENT_ARTIFACT_MAX_NODES,
      }),
    );
    return { ...result, structuredFile };
  } catch {
    return undefined;
  }
}
