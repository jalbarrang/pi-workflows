import { isSafeCommand, parseCommandSegments } from "@dreki-gg/pi-command-sandbox";

/**
 * Shell constructs no `allowCommands` pattern can make runnable, because the
 * matcher never sees the command they would actually execute.
 *
 * Control flow is the one that costs real time: `find … | while read f; do wc -l
 * $f; done` is the natural idiom for a line-count gate, and a reviewer that cannot
 * run it reports "(no output)" — which reads exactly like a passing gate.
 */
const CONSTRUCTS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /(?:^|[\s;|&])(?:while|for|until|if|case|function)(?:\s|$)|;\s*do\b/,
    hint:
      "shell control flow (while/for/if) is never runnable, whatever allowCommands says. " +
      "Use one command per bash call — `find … -exec wc -l {} +` instead of a `while read` loop.",
  },
  { pattern: /\$\(|`/, hint: "command substitution is refused." },
  {
    pattern: /(?:^|\s)\d?>{1,2}[&\s]|\s2>&1/,
    hint: "output redirects are refused; read the output instead.",
  },
  { pattern: /^\s*[A-Za-z_][A-Za-z0-9_]*=/, hint: "inline environment assignments are refused." },
];

/** Name the first segment of a chain that the policy refuses. */
function offendingSegment(command: string, options: Parameters<typeof isSafeCommand>[1]) {
  const segments = parseCommandSegments(command);
  if (segments.length < 2) return undefined;
  const failing = segments.find((segment) => !isSafeCommand(segment.command, options));
  return failing?.command;
}

/**
 * Explain a denial well enough to act on.
 *
 * A pipeline is allowed when every segment passes independently, so the useful
 * information is *which* segment failed and whether the cause is a construct that
 * cannot be widened at all.
 */
export function explainDenial(
  command: string,
  options: Parameters<typeof isSafeCommand>[1],
): string {
  const parts = [`Command "${command}" is not permitted for a governed workflow agent.`];
  const segment = offendingSegment(command, options);
  if (segment && segment !== command.trim()) parts.push(`The blocked part is \`${segment}\`.`);
  const construct = CONSTRUCTS.find((entry) => entry.pattern.test(command));
  if (construct) parts.push(`Note: ${construct.hint}`);
  else parts.push("Commands are read-only by default; widen them with allowCommands.");
  return parts.join(" ");
}
