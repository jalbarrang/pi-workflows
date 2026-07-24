import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel, WorkflowModel } from "../agent/index.ts";
import type { AgentCallOptions } from "./input.ts";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

/**
 * Only the parts of ExtensionContext model resolution needs. Narrow on purpose:
 * the preflight and its tests can supply a registry without a whole session.
 */
export interface ModelResolutionContext {
  model?: ExtensionContext["model"];
  modelRegistry: ExtensionContext["modelRegistry"];
}

export function resolveModel(
  options: AgentCallOptions,
  context: ModelResolutionContext,
): { model?: WorkflowModel; error?: string } {
  if (options.model === undefined && options.provider === undefined)
    return { model: context.model };
  const model = typeof options.model === "string" ? options.model : undefined;
  const provider = typeof options.provider === "string" ? options.provider : undefined;
  if (!model) return { error: "`provider` requires `model` as well" };
  let resolved: WorkflowModel | undefined;
  if (provider) resolved = context.modelRegistry.find(provider, model);
  else {
    const slash = model.indexOf("/");
    if (slash > 0)
      resolved = context.modelRegistry.find(model.slice(0, slash), model.slice(slash + 1));
    resolved ??= context.modelRegistry.getAll().find((candidate) => candidate.id === model);
  }
  return resolved
    ? { model: resolved }
    : { error: `unknown model "${provider ? `${provider}/` : ""}${model}" (use provider/id)` };
}
export function resolveEffort(options: AgentCallOptions, inherited: ThinkingLevel) {
  if (options.effort === undefined) return { effort: inherited };
  const effort = String(options.effort);
  if (!(THINKING_LEVELS as readonly string[]).includes(effort)) {
    return { error: `invalid effort "${effort}" (use ${THINKING_LEVELS.join("|")})` };
  }
  return { effort: effort as ThinkingLevel };
}
