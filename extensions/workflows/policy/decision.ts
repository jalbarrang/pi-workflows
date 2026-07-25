export interface CommandDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * The caller's write fence, expressed as a predicate.
 *
 * Passing a predicate rather than globs keeps path canonicalization in `agent/`
 * and leaves `policy/` knowing only about commands.
 */
export interface WriteFence {
  inScope(path: string): boolean;
  describe(): string;
}

/** A mutating command a fenced agent may run once its paths are checked. */
export interface FencedRequest {
  verb: string;
  paths: string[];
}

/**
 * Outcome of recognizing a fenced command.
 *
 * `recognized` means "this is the command we allow inside a fence", so a rejection
 * can name what is wrong with it instead of falling through to the generic
 * read-only denial. Agents reach for `git mv -f` constantly; a message that does
 * not say "drop the -f" costs a whole run.
 */
export interface FencedParse {
  recognized: boolean;
  request?: FencedRequest;
  reason?: string;
}
