import { createBashToolDefinition, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { CommandPolicyShape, RelocationFence } from "../policy/index.ts";

export interface PolicyBashOptions {
  allowCommands?: readonly string[];
  /** Write fence that makes an in-scope `git mv` permissible. */
  fence?: RelocationFence;
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
        throw new Error(decision.reason ?? "Command denied by the workflow command policy");
      }
      return (base as ToolDefinition).execute(toolCallId, params, signal, onUpdate, ctx);
    },
  };
  return guarded;
}
