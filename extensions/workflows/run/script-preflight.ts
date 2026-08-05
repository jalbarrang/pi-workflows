import type { ThinkingLevel } from "../agent/index.ts";
import { AGENT_OPTION_KEYS } from "../sandbox/index.ts";
import { collectStaticAgentCalls } from "../scripting/index.ts";
import type { AgentCallOptions } from "./input.ts";
import { resolveAgentOptions } from "./agent-options.ts";
import { preflightModels } from "./model-preflight.ts";
import { resolveModel, type ModelResolutionContext } from "./model-resolution.ts";

const VALID_KEYS = new Set<string>(AGENT_OPTION_KEYS);

function at(call: { line: number; column: number }, message: string) {
  return `${call.line}:${call.column} ${message}`;
}

/**
 * Compiler-style preflight for statically decidable `agent()` mistakes.
 *
 * Dynamic option values are deliberately deferred to runtime. Rejecting a call
 * based on a guessed value would make valid workflows impossible to express.
 */
export function preflightWorkflowScript(
  source: string,
  context: ModelResolutionContext,
  inherited: ThinkingLevel,
) {
  const diagnostics: string[] = [];
  for (const call of collectStaticAgentCalls(source)) {
    if (call.emptyPrompt) diagnostics.push(at(call, "agent() requires a non-empty prompt string"));
    const unknown = [...new Set(call.optionKeys.filter((key) => !VALID_KEYS.has(key)))];
    if (unknown.length > 0) {
      const plural = unknown.length > 1 ? "s" : "";
      const listed = unknown.map((key) => `"${key}"`).join(", ");
      diagnostics.push(
        at(call, `unknown agent option${plural} ${listed} (valid: ${AGENT_OPTION_KEYS.join("|")})`),
      );
    }
    if (!call.options) continue;
    const options = call.options as AgentCallOptions;
    const modelError = resolveModel(options, context).error;
    if (modelError && !modelError.startsWith("unknown model")) {
      diagnostics.push(at(call, modelError));
    }
    const nonModelOptions = { ...options };
    delete nonModelOptions.model;
    delete nonModelOptions.provider;
    const optionError = resolveAgentOptions(nonModelOptions, context, inherited).error;
    if (optionError) diagnostics.push(at(call, optionError));
  }
  const modelError = preflightModels(source, context);
  if (modelError) diagnostics.push(modelError);
  if (diagnostics.length === 0) return undefined;
  return `Workflow script failed static validation:\n- ${diagnostics.join("\n- ")}`;
}
