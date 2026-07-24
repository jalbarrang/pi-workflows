/** Escape every regex metacharacter so a pattern can only match literally. */
function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reject patterns that would silently widen the policy to everything. Allowing
 * every command must be an explicit decision, never the accidental result of a
 * lazy glob.
 */
function tooBroad(pattern: string) {
  return pattern.replace(/[*\s]/g, "") === "";
}

/**
 * Compile an `allowCommands` glob into an anchored regex.
 *
 * `*` matches within a single argument; a trailing `*` matches the rest of the
 * command so `npm run *` covers `npm run build --if-present`. Patterns are
 * matched against each parsed command segment, so a pattern can never span a
 * `&&` or a pipe.
 */
export function compileAllowPattern(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (!trimmed) throw new Error("allowCommands patterns cannot be empty");
  if (tooBroad(trimmed)) {
    throw new Error(`allowCommands pattern "${pattern}" would allow every command`);
  }
  const trailing = trimmed.endsWith("*");
  const body = trailing ? trimmed.slice(0, -1) : trimmed;
  const compiled = escape(body).replace(/\\\*/g, "[^\\s]*");
  return new RegExp(`^${compiled}${trailing ? ".*" : ""}$`);
}

export function compileAllowPatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map(compileAllowPattern);
}
