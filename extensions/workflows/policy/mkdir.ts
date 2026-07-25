import type { FencedParse } from "./decision.ts";
import { fencedTokens, operatorReason, parseOperands } from "./tokens.ts";

/** `-m` would set permissions, which is not a directory-creation concern. */
const SAFE_FLAGS = new Set(["-p", "--parents"]);

const FLAG_REASON = (flag: string) =>
  `\`mkdir\` flag "${flag}" is not permitted inside a write fence. ` +
  "Permitted flags: -p. Use a plain `mkdir -p <dir>`.";

/**
 * Recognize a bare `mkdir [-p] <directory>`.
 *
 * Allowed for the same reason as `git mv`: a fenced agent restructuring a tree has
 * to create the destination, and `mkdir` cannot destroy anything — it fails when a
 * file exists at the path and is a no-op on an existing directory with `-p`. The
 * implicit alternative (letting `write` create parents) only works when the agent
 * has a file to write, which a relocation does not.
 */
export function parseMkdir(command: string): FencedParse {
  const tokens = fencedTokens(command);
  if (tokens[0] !== "mkdir") return { recognized: false };
  const operators = operatorReason(command, "mkdir");
  if (operators) return { recognized: true, reason: operators };
  const { operands, badFlag } = parseOperands(tokens.slice(1), SAFE_FLAGS);
  if (badFlag) return { recognized: true, reason: FLAG_REASON(badFlag) };
  if (operands.length !== 1) {
    return {
      recognized: true,
      reason: "`mkdir` inside a write fence takes exactly one directory path.",
    };
  }
  return { recognized: true, request: { verb: "mkdir", paths: operands } };
}
