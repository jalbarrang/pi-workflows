import type { FencedParse } from "./decision.ts";
import { fencedTokens, operatorReason, parseOperands } from "./tokens.ts";

/** Flags that cannot turn `git mv` into something that destroys work. */
const SAFE_FLAGS = new Set(["-v", "--verbose", "-n", "--dry-run"]);

const FLAG_REASON = (flag: string) =>
  `\`git mv\` flag "${flag}" is not permitted inside a write fence. Drop it: the fence ` +
  "relies on git mv refusing to overwrite an existing path. Permitted flags: -v, -n. " +
  "If the destination already exists, delete or rename it with an edit instead.";

/**
 * Recognize a bare `git mv <source> <destination>`.
 *
 * `git mv` is the one mover worth allowing inside a write fence: it refuses to
 * clobber an existing path (as long as `-f` is not permitted), it cannot leave the
 * work tree, and it produces a reviewable rename rather than a delete plus an
 * untracked file. Without it a fenced agent cannot extract a module at all, which
 * is exactly the work a fence is most wanted for.
 *
 * The caller decides whether the paths are in scope; this module knows nothing
 * about fences.
 */
export function parseRelocation(command: string): FencedParse {
  const tokens = fencedTokens(command);
  if (tokens[0] !== "git" || tokens[1] !== "mv") return { recognized: false };
  const operators = operatorReason(command, "git mv");
  if (operators) return { recognized: true, reason: operators };
  const { operands, badFlag } = parseOperands(tokens.slice(2), SAFE_FLAGS);
  if (badFlag) return { recognized: true, reason: FLAG_REASON(badFlag) };
  if (operands.length !== 2) {
    return {
      recognized: true,
      reason: "`git mv` inside a write fence takes exactly two paths: a source and a destination.",
    };
  }
  return { recognized: true, request: { verb: "git mv", paths: operands } };
}
