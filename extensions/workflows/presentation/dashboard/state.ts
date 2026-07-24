import type { ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { AgentRecord, WorkflowDetails } from "../../run/types.ts";
import { phaseGroups } from "../../run/groups.ts";
import type { RunEntry } from "./load.ts";

export type DashboardView = "list" | "detail" | "transcript";
export interface DashboardState {
  tui: TUI;
  theme: ExtensionContext["ui"]["theme"];
  keys: KeybindingsManager;
  entries: RunEntry[];
  view: DashboardView;
  listIndex: number;
  phaseIndex: number;
  agentIndex: number;
  focus: "phases" | "agents";
  scroll: number;
  transcriptRows: number;
  viewport: number;
  current?: RunEntry;
  notice?: string;
  noticeAt?: number;
  close(): void;
}
export const wrapSelection = (index: number, delta: number, length: number) =>
  length ? (index + delta + length) % length : 0;
export function selectedGroup(state: DashboardState) {
  if (!state.current) return undefined;
  return phaseGroups(state.current.details, true)[state.phaseIndex];
}
export function selectedAgent(state: DashboardState): AgentRecord | undefined {
  return selectedGroup(state)?.agents[state.agentIndex];
}
export function activeDetails(active: ReadonlyMap<string, { details: WorkflowDetails }>) {
  return new Map([...active].map(([id, run]) => [id, run.details] as const));
}
