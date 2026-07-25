import type { AgentOptionKey } from "./option-keys.ts";

/** Derived from AGENT_OPTION_KEYS so the IPC payload cannot drift from the DSL. */
export type SandboxAgentOptions = { [Key in AgentOptionKey]?: unknown };

export interface SandboxAgentResult {
  ok: boolean;
  output: string;
  structured?: unknown;
  error?: string;
}

export interface RunWorkflowSandboxOptions {
  source: string;
  args: unknown;
  /** A previous run's `result.json`, exposed to the script as `previous`. */
  previousJson?: string;
  cwd: string;
  signal: AbortSignal;
  onAgent(
    prompt: string,
    options: SandboxAgentOptions,
    signal: AbortSignal,
    /** Option keys the script passed that the DSL does not define. */
    unknownKeys?: readonly string[],
  ): Promise<SandboxAgentResult>;
  onPhase(title: string): void;
}
