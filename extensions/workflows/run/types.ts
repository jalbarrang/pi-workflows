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
  /** Transport fault after a recorded result: the agent is `done`, not failed. */
  deliveryError?: string;
  /** Commands the command policy refused during this agent's run. */
  deniedCommands?: string[];
  /** Declared best-effort: this agent failing is not a hole in its phase. */
  optional?: boolean;
  preview: string;
  /**
   * Absolute path to this agent's full output, written the moment the outcome
   * lands so it survives a script crash, a dead sandbox, or an abort.
   */
  outputFile?: string;
  structuredFile?: string;
  outputBytes?: number;
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
  /**
   * Declared phases that produced no successful agent. Machine-readable and
   * independent of whatever the script chose to return, so a phase that silently
   * produced nothing cannot read as a phase that ran clean.
   */
  incompletePhases?: string[];
  /** Why a `required: true` agent stopped the run. */
  requiredFailure?: string;
  /** Run id whose result was handed to this script as `previous`. */
  resumedFrom?: string;
}

export interface ActiveRun {
  details: WorkflowDetails;
  controller: import("./controller.ts").RunController;
  completion?: Promise<void>;
}
