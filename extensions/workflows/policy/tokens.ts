/**
 * Anything that could change which command actually runs, or hide a second one.
 *
 * A fenced command is decided on the raw string, before segmentation, so this is
 * what keeps `git mv a b && rm -rf .` from riding along. Quotes are rejected too:
 * a quoted path is not worth the parsing surface.
 */
const SHELL_OPERATORS = /[&|;<>`$(){}[\]*?~!#\\'"\n\r]/;

export function fencedTokens(command: string): string[] {
  return command.trim().split(/\s+/);
}

/** Reason a fenced command is unusable as written, or undefined when it is plain. */
export function operatorReason(command: string, verb: string): string | undefined {
  if (!SHELL_OPERATORS.test(command)) return undefined;
  return (
    `\`${verb}\` inside a write fence must be a single plain command: no pipes, ` +
    "redirects, chaining, globs, quotes, or substitution. Run it on its own."
  );
}

export interface Operands {
  operands: string[];
  badFlag?: string;
}

/** Split flags from path operands, reporting the first flag outside the safe set. */
export function parseOperands(tokens: readonly string[], safeFlags: ReadonlySet<string>): Operands {
  const operands: string[] = [];
  for (const token of tokens) {
    if (!token.startsWith("-")) {
      operands.push(token);
      continue;
    }
    if (!safeFlags.has(token)) return { operands, badFlag: token };
  }
  return { operands };
}
