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
  /**
   * Set on an otherwise successful result when the agent's answer was recorded
   * but its transport then died. The work stands; the delivery did not.
   */
  deliveryError?: string;
}

/**
 * Derived from AGENT_OPTION_KEYS so the accepted keys and the validated keys can
 * never drift apart. Values stay `unknown` because scripts are untrusted.
 */
export type AgentCallOptions = { [Key in AgentOptionKey]?: unknown };
