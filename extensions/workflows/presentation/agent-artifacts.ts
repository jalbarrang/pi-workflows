import type { AgentRecord } from "../run/types.ts";
import { shortenHome } from "./path.ts";

/** Human-readable paths for every persisted artifact this agent actually produced. */
export function agentArtifactSummaries(agent: AgentRecord, shortenPaths = false) {
  const displayPath = shortenPaths ? shortenHome : (value: string) => value;
  const summaries: string[] = [];
  if (agent.outputFile) {
    const bytes = agent.outputBytes === undefined ? "" : ` (${agent.outputBytes} bytes)`;
    summaries.push(`output: ${displayPath(agent.outputFile)}${bytes}`);
  }
  if (agent.structuredFile) {
    summaries.push(`structured: ${displayPath(agent.structuredFile)}`);
  }
  return summaries;
}
