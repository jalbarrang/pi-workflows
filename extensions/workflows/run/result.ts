import { safeStringify } from "../artifacts/index.ts";
import type { WorkflowDetails } from "./types.ts";

export function compactToolDetails(details: WorkflowDetails): WorkflowDetails {
  return {
    ...details,
    ...(details.result === undefined
      ? {}
      : { result: JSON.parse(safeStringify(details.result, { maxBytes: 64 * 1024 })) }),
    agents: details.agents.map((agent) => ({ ...agent, transcript: [] })),
  };
}
export function parseArgs(value: string | undefined) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
