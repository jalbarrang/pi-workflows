import type { AgentOptionKey } from "../sandbox/index.ts";

export interface WorkflowInput {
  script: string;
  args?: string;
  background?: boolean;
  /** Run id whose returned value is exposed to this script as `previous`. */
  resume?: string;
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
  /**
   * Commands the policy refused. Present so an orchestrator can tell an agent
   * that had nothing to do from one that was blocked from doing it.
   */
  deniedCommands?: string[];
}

/**
 * Derived from AGENT_OPTION_KEYS so the accepted keys and the validated keys can
 * never drift apart. Values stay `unknown` because scripts are untrusted.
 */
export type AgentCallOptions = { [Key in AgentOptionKey]?: unknown };
