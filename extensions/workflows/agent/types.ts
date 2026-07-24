import type {
  AgentSession,
  DefaultResourceLoader,
  ExtensionAPI,
  ExtensionContext,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { CommandPolicyShape } from "../policy/index.ts";
import type { AgentUsage, TranscriptEntry } from "../run/types.ts";

export type WorkflowModel = NonNullable<ExtensionContext["model"]>;
export type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
export type AgentMessage = AgentSession["messages"][number];
export interface ToolExecutionTiming {
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}
export interface AgentOutcome {
  ok: boolean;
  output: string;
  structured?: unknown;
  error?: string;
  /** Transport fault that arrived after the result was already recorded. */
  deliveryError?: string;
  /** Commands the policy refused, so "blocked" is distinguishable from "unneeded". */
  deniedCommands?: string[];
  aborted: boolean;
  usage: AgentUsage;
  model?: string;
  contextWindow?: number;
  transcript: TranscriptEntry[];
}
export interface AgentProgress {
  preview: string;
  usage: AgentUsage;
  model?: string;
  contextWindow?: number;
  transcript: TranscriptEntry[];
}
export interface RunAgentOptions {
  prompt: string;
  schema?: unknown;
  model?: WorkflowModel;
  thinkingLevel?: ThinkingLevel;
  cwd: string;
  loader: DefaultResourceLoader;
  settingsManager: SettingsManager;
  modelRegistry: ExtensionContext["modelRegistry"];
  signal?: AbortSignal;
  onProgress?(progress: AgentProgress): void;
  toolCallTimeoutMs?: number;
  firstResponseTimeoutMs?: number;
  /** Drop write/edit and route bash through `checkCommand`. */
  readOnly?: boolean;
  /** Fence write/edit to these cwd-relative globs. */
  writeScope?: readonly string[];
  /** Route bash through `checkCommand`. Implied by readOnly and by writeScope. */
  policyGoverned?: boolean;
  /** Extra command patterns a read-only agent may run (verification gates). */
  allowCommands?: readonly string[];
  /** Command policy decision function, resolved from the CommandPolicy layer. */
  checkCommand?: CommandPolicyShape["check"];
}
