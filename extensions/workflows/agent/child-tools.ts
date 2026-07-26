import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { compact } from "../shared/compact.ts";
import { createPolicyBashTool } from "./policy-bash.ts";
import { createScopedWriteTools } from "./scoped-tools.ts";
import { makeStructuredOutputTool } from "./structured.ts";
import type { RunAgentOptions } from "./types.ts";
import { createWriteFence } from "./write-scope.ts";

export interface ChildToolHooks {
  structured(value: unknown): void;
  denied?(command: string): void;
}

/**
 * Assemble the custom tools a child session needs, as data.
 *
 * Kept separate from session creation so the tool-set decision is testable
 * without a live model: an unscoped agent must produce exactly zero custom tools,
 * which is what keeps default behavior identical to upstream.
 */
export function buildChildCustomTools(
  options: RunAgentOptions,
  hooks: ChildToolHooks,
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  if (options.schema !== undefined) {
    tools.push(makeStructuredOutputTool(options.schema, hooks.structured));
  }
  const governed = options.policyGoverned ?? options.readOnly === true;
  // A fence exists only where write tools do: a read-only agent must not relocate.
  const fenced = options.writeScope && !options.readOnly ? options.writeScope : undefined;
  if (governed && options.checkCommand) {
    tools.push(
      createPolicyBashTool(
        options.cwd,
        options.checkCommand,
        compact({
          allowCommands: options.allowCommands,
          fence: fenced ? createWriteFence(options.cwd, fenced) : undefined,
          onDenied: hooks.denied,
        }),
      ),
    );
  }
  if (fenced) tools.push(...createScopedWriteTools(options.cwd, fenced));
  return tools;
}
