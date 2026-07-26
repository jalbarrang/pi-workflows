/**
 * Commands no `allowCommands` pattern may ever re-enable.
 *
 * `allowCommands` widens the *safe* list, and the sandbox checks destructive
 * patterns first, so this list is the only way to keep a plausible author-written
 * pattern from granting arbitrary execution. Without it, `allowCommands: ["node
 * *"]` — perfectly reasonable for running a repo script — also grants `node -e
 * "<anything>"`, and `["sh *"]` grants a whole shell. Both were caught escaping a
 * read-only agent by the escape-attempt suite.
 *
 * Anchored per command segment: the parser splits on `&&`, `;`, `|` before these
 * run, so `^` means the start of one command.
 */
export const NEVER_ALLOWED_PATTERNS: RegExp[] = [
  // Re-entering a shell hands the real command to a parser we never inspect.
  /^\s*(?:sh|bash|zsh|dash|ksh|fish|csh|tcsh|ash|busybox)\b/i,
  // PowerShell is unparseable by a POSIX tokenizer, so it is a total bypass.
  /^\s*(?:powershell(?:\.exe)?|pwsh)\b/i,
  // Wrappers that execute a different command than the one being matched.
  /^\s*(?:env|nohup|xargs|nice|time|timeout|script|setsid|stdbuf|watch)\b/i,
  // Shell builtins that evaluate their arguments.
  /^\s*(?:eval|exec|source|\.)\s/i,
  // Interpreter eval flags: the payload never reaches the command matcher.
  /^\s*(?:node|deno|bun)\b.*\s-(?:e|-eval|p|-print)\b/i,
  /^\s*(?:python[23]?|perl|ruby|php)\b.*\s-(?:c|e|r)\b/i,
  // Ripgrep can execute caller-selected programs through these options.
  /^\s*rg\b.*\s--(?:pre|hostname-bin)(?:=|\s|$)/i,
  // Fetch-and-run package launchers execute code that is not in the repo.
  /^\s*(?:npx|bunx)\b/i,
  /^\s*(?:npm|pnpm|yarn)\s+(?:exec|dlx|x)\b/i,
];
