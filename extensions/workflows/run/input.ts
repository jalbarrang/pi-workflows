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
  /**
   * Absolute path to this agent's full output on disk. `output` is capped for the
   * IPC channel; this file is not. Hand the path to the next agent and tell it to
   * `read` the file rather than interpolating `output` into its prompt — a large
   * interpolated output is what overflows the prompt limit.
   */
  outputFile?: string;
  /** Absolute path to the validated structured payload, when a schema was used. */
  structuredFile?: string;
  /** Size of the file at `outputFile`, which may exceed `output.length`. */
  outputBytes?: number;
  /** True when `output` was cut and `outputFile` holds strictly more than it. */
  outputTruncated?: boolean;
}

/**
 * Derived from AGENT_OPTION_KEYS so the accepted keys and the validated keys can
 * never drift apart. Values stay `unknown` because scripts are untrusted.
 */
export type AgentCallOptions = { [Key in AgentOptionKey]?: unknown };
