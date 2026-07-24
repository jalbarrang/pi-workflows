import type { AgentOptionKey } from "../sandbox/index.ts";

export interface WorkflowInput {
  script: string;
  args?: string;
  background?: boolean;
}

export interface ScriptAgentResult {
  ok: boolean;
  output: string;
  structured?: unknown;
  error?: string;
}

/**
 * Derived from AGENT_OPTION_KEYS so the accepted keys and the validated keys can
 * never drift apart. Values stay `unknown` because scripts are untrusted.
 */
export type AgentCallOptions = { [Key in AgentOptionKey]?: unknown };
