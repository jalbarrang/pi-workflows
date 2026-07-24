export interface SandboxAgentOptions {
  label?: unknown;
  phase?: unknown;
  schema?: unknown;
  model?: unknown;
  provider?: unknown;
  effort?: unknown;
}

export interface SandboxAgentResult {
  ok: boolean;
  output: string;
  structured?: unknown;
  error?: string;
}

export interface RunWorkflowSandboxOptions {
  source: string;
  args: unknown;
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
