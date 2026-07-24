import {
  createEditToolDefinition,
  createWriteToolDefinition,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { checkWriteScope } from "./write-scope.ts";

/**
 * Wrap a path-taking tool so it can only mutate files inside `globs`.
 *
 * Validation only — the wrapped built-in still owns the actual mutation and its
 * file-mutation queue, so parallel writes stay serialized as before. A denial
 * throws, which pi turns into an error tool result the child agent can react to.
 */
function scopeTool(base: ToolDefinition, cwd: string, globs: readonly string[]): ToolDefinition {
  return {
    ...base,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const requested = (params as { path?: unknown }).path;
      const decision = checkWriteScope(cwd, typeof requested === "string" ? requested : "", globs);
      if (!decision.allowed) throw new Error(decision.reason);
      return base.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  };
}

/** Scoped replacements for the built-in `write` and `edit` tools. */
export function createScopedWriteTools(cwd: string, globs: readonly string[]): ToolDefinition[] {
  return [
    scopeTool(createWriteToolDefinition(cwd) as ToolDefinition, cwd, globs),
    scopeTool(createEditToolDefinition(cwd) as ToolDefinition, cwd, globs),
  ];
}
