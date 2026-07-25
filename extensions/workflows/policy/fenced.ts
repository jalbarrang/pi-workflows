import type { CommandDecision, FencedParse, WriteFence } from "./decision.ts";
import { parseMkdir } from "./mkdir.ts";
import { parseRelocation } from "./relocate.ts";

/** Recognize the mutating commands a write fence may permit. */
export function parseFencedCommand(command: string): FencedParse {
  const relocation = parseRelocation(command);
  if (relocation.recognized) return relocation;
  return parseMkdir(command);
}

/**
 * Rule on a recognized fenced command.
 *
 * Every path must be inside the fence, and the denial names the paths that are not
 * — the fence exists to make a relocation reviewable, so a vague refusal defeats
 * the point. Without a fence the command stays denied: an ungoverned agent never
 * reaches this code, and a read-only agent must not mutate anything.
 */
export function decideFencedCommand(
  parse: FencedParse,
  fence: WriteFence | undefined,
): CommandDecision {
  if (parse.reason) return { allowed: false, reason: parse.reason };
  const request = parse.request;
  if (!request) return { allowed: false };
  if (!fence) {
    return {
      allowed: false,
      reason:
        `\`${request.verb}\` is only permitted for an agent with a writeScope, ` +
        "and only inside it. A read-only agent cannot mutate the tree.",
    };
  }
  const outside = request.paths.filter((path) => !fence.inScope(path));
  if (outside.length === 0) return { allowed: true };
  return {
    allowed: false,
    reason:
      `\`${request.verb}\` would touch ${outside.join(" and ")}, outside this agent's ` +
      `writeScope (${fence.describe()}). Both paths must be inside the fence; ` +
      "another agent may own that area of the tree.",
  };
}
