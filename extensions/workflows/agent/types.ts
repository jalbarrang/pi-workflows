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
/**
 * Persist an agent's answer at full fidelity and report where it landed.
 *
 * Injected rather than imported so the agent layer stays ignorant of run
 * directories: it holds the only copy of the untruncated output, and this is the
 * one call it makes with it.
 */
export type PersistAgentOutput = (payload: {
  output: string;
  structured?: unknown;
}) => AgentOutputArtifacts | undefined;

export interface AgentOutputArtifacts {
  outputFile: string;
  structuredFile?: string;
  outputBytes: number;
}

export interface AgentOutcome {
  ok: boolean;
  /** Capped at OUTPUT_MAX_BYTES. `outputFile` holds the whole answer. */
  output: string;
  outputFile?: string;
  structuredFile?: string;
  outputBytes?: number;
  /** True when `output` was cut, so a reader knows the file holds strictly more. */
  outputTruncated?: boolean;
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
  /** Optional wall-clock bound for this agent's model loop. */
  maxDurationMs?: number;
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
  /** Write the untruncated answer to disk. Absent in tests that do not care. */
  persistOutput?: PersistAgentOutput;
}
