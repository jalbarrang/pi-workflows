/** A relocation the policy may permit when both operands are inside the fence. */
export interface RelocationRequest {
  source: string;
  destination: string;
}

/**
 * Anything that could change which command actually runs, or hide a second one.
 *
 * A relocation is decided on the raw command string, before segmentation, so this
 * rejection is what keeps `git mv a b && rm -rf .` from riding along. Quotes are
 * rejected too: a quoted path is not worth the parsing surface, and the denial
 * reason tells the author to rename without spaces.
 */
const UNSAFE_CHARACTERS = /[&|;<>`$(){}[\]*?~!#\\'"\n\r]/;

/** Flags that cannot turn `git mv` into something that destroys work. */
const SAFE_FLAGS = new Set(["-v", "--verbose", "-n", "--dry-run"]);

/**
 * Recognize a bare `git mv <source> <destination>`.
 *
 * `git mv` is the one mover worth allowing inside a write fence: it refuses to
 * clobber an existing path (as long as `-f` is not permitted), it cannot leave the
 * work tree, and it produces a reviewable rename rather than a delete plus an
 * untracked file. Without it a fenced agent cannot extract a module at all, which
 * is exactly the work a fence is most wanted for.
 *
 * Returns undefined for anything that is not unambiguously that command. The
 * caller decides whether the two paths are in scope; this module knows nothing
 * about fences.
 */
export function parseRelocation(command: string): RelocationRequest | undefined {
  if (UNSAFE_CHARACTERS.test(command)) return undefined;
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== "git" || tokens[1] !== "mv") return undefined;
  const operands: string[] = [];
  for (const token of tokens.slice(2)) {
    if (token.startsWith("-")) {
      if (!SAFE_FLAGS.has(token)) return undefined;
      continue;
    }
    operands.push(token);
  }
  if (operands.length !== 2) return undefined;
  return { source: operands[0], destination: operands[1] };
}
