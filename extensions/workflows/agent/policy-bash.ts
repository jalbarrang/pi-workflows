import { createBashToolDefinition, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { CommandPolicyShape, WriteFence } from "../policy/index.ts";

/**
 * Denials are reported to the run, but the agent is the one writing the summary a
 * human reads. Told to account for the refusal, a model reports being blocked
 * instead of quietly working around it and claiming success.
 */
const ACCOUNT_FOR_DENIAL =
  "Do not proceed as if this check passed: state in your final answer that this " +
  "command was denied and what you could not verify or change because of it.";

export interface PolicyBashOptions {
  allowCommands?: readonly string[];
  /** Write fence that makes an in-scope `git mv` or `mkdir` permissible. */
  fence?: WriteFence;
  /** Called for every refused command so the run can report it. */
  onDenied?: (command: string) => void;
}

/**
 * Bash for a governed agent: the real built-in tool behind a command policy.
 *
 * Registered under the name `bash` so it replaces the built-in in the child's
 * tool registry (pi seeds built-ins first, then lets custom tools overwrite by
 * name). The tool must NOT also appear in `excludeTools`, or the override is
 * filtered out along with the original.
 *
 * A denied command throws, which is how pi marks a tool result as an error: the
 * child agent sees the failure and can adapt instead of the run dying. The denial
 * is also reported upward, because an agent that adapts by doing nothing is
 * otherwise indistinguishable from one that had nothing to do.
 */
export function createPolicyBashTool(
  cwd: string,
  check: CommandPolicyShape["check"],
  options: PolicyBashOptions = {},
): ToolDefinition {
  const base = createBashToolDefinition(cwd);
  const guarded: ToolDefinition = {
    ...(base as ToolDefinition),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const requested = (params as { command?: unknown }).command;
      const command = typeof requested === "string" ? requested : "";
      const decision = check(command, options.allowCommands, options.fence);
      if (!decision.allowed) {
        options.onDenied?.(command);
        const reason = decision.reason ?? "Command denied by the workflow command policy.";
        throw new Error(`${reason} ${ACCOUNT_FOR_DENIAL}`);
      }
      return (base as ToolDefinition).execute(toolCallId, params, signal, onUpdate, ctx);
    },
  };
  return guarded;
}
