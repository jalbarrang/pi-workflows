import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createPolicyBashTool } from "./policy-bash.ts";
import { createScopedWriteTools } from "./scoped-tools.ts";
import { makeStructuredOutputTool } from "./structured.ts";
import type { RunAgentOptions } from "./types.ts";

/**
 * Assemble the custom tools a child session needs, as data.
 *
 * Kept separate from session creation so the tool-set decision is testable
 * without a live model: an unscoped agent must produce exactly zero custom tools,
 * which is what keeps default behavior identical to upstream.
 */
export function buildChildCustomTools(
  options: RunAgentOptions,
  capture: (value: unknown) => void,
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (options.schema !== undefined) {
    tools.push(makeStructuredOutputTool(options.schema, capture));
  }
  const governed = options.policyGoverned ?? options.readOnly === true;
  if (governed && options.checkCommand) {
    tools.push(createPolicyBashTool(options.cwd, options.checkCommand, options.allowCommands));
  }
  if (options.writeScope && !options.readOnly) {
    tools.push(...createScopedWriteTools(options.cwd, options.writeScope));
  }
  return tools;
}
