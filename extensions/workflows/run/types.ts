import type { WorkflowPhase } from "../scripting/types.ts";

export type AgentState = "running" | "done" | "error";
export type WorkflowStatus = "running" | "completed" | "failed" | "aborted";

export interface AgentUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  turns: number;
  contextTokens?: number;
}

export type TranscriptRole = "user" | "assistant" | "thinking" | "tool" | "toolResult";
export interface TranscriptEntry {
  role: TranscriptRole;
  text: string;
  name?: string;
  toolCallId?: string;
  isError?: boolean;
  timestamp?: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface AgentRecord {
  index: number;
  label: string;
  phase?: string;
  state: AgentState;
  model?: string;
  contextWindow?: number;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  preview: string;
  usage: AgentUsage;
  transcript: TranscriptEntry[];
}

export interface WorkflowDetails {
  runId: string;
  sessionId?: string;
  name?: string;
  description?: string;
  background: boolean;
  status: WorkflowStatus;
  startedAt: number;
  finishedAt?: number;
  phases: WorkflowPhase[];
  currentPhase?: string;
  agents: AgentRecord[];
  result?: unknown;
  resultArtifact?: string;
  transcriptArtifact?: string;
  error?: string;
}

export interface ActiveRun {
  details: WorkflowDetails;
  controller: import("./controller.ts").RunController;
  completion?: Promise<void>;
}
