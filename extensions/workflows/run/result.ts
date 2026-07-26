import { safeStringify } from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";
import type { WorkflowDetails } from "./types.ts";

export function compactToolDetails(details: WorkflowDetails): WorkflowDetails {
  return compact({
    ...details,
    result:
      details.result === undefined
        ? undefined
        : JSON.parse(safeStringify(details.result, { maxBytes: 64 * 1024 })),
    agents: details.agents.map((agent) => ({ ...agent, transcript: [] })),
  });
}
export function parseArgs(value: string | undefined) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
