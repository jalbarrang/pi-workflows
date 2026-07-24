import { collectModelRefs } from "../scripting/index.ts";
import { resolveModel, type ModelResolutionContext } from "./model-resolution.ts";

function label(ref: { model: string; provider?: string }) {
  return `"${ref.provider ? `${ref.provider}/${ref.model}` : ref.model}"`;
}

/**
 * Validate every statically declared model before the run starts.
 *
 * `resolveModel` already fails loudly, but only when its own `agent()` call
 * executes, so a typo in a late phase burns every earlier phase first. Models
 * can also disappear from `models.json` between runs, which is exactly the
 * failure that motivated this check. Dynamic model expressions are skipped.
 *
 * Returns an error message naming every offender, or undefined when clean.
 */
export function preflightModels(source: string, context: ModelResolutionContext) {
  let refs;
  try {
    refs = collectModelRefs(source);
  } catch {
    // Unparseable source is reported by prepareWorkflowScript, not here.
    return undefined;
  }
  const unknown: string[] = [];
  for (const ref of refs) {
    if (!resolveModel(ref, context).error) continue;
    const named = label(ref);
    if (!unknown.includes(named)) unknown.push(named);
  }
  if (unknown.length === 0) return undefined;
  return `Workflow references unknown models: ${unknown.join(", ")} (use provider/id)`;
}
