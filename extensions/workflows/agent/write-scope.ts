import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";

/**
 * Canonicalize as far as the filesystem allows, then re-append the missing tail.
 *
 * Resolving the closest existing ancestor defeats two bypasses at once: a symlink
 * inside the scope that points outside it, and case-only variants such as
 * `Client/x` for a real `client/` directory on case-insensitive filesystems,
 * because the native realpath returns the on-disk casing.
 */
function canonicalize(absolute: string): string {
  let current = absolute;
  const tail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync.native(current);
      return tail.length > 0 ? join(real, ...[...tail].reverse()) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return absolute;
      tail.push(basename(current));
      current = parent;
    }
  }
}

function toPattern(glob: string) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // Alternation order matters: `**` is consumed before a bare `*`, so the two
  // stay distinct without a placeholder substitution pass.
  const expanded = escaped.replace(/\*\*|\*/g, (match) => (match === "**" ? ".*" : "[^/]*"));
  return new RegExp(`^${expanded}$`);
}

export function matchesWriteScope(relativePath: string, globs: readonly string[]) {
  return globs.some((glob) => toPattern(glob).test(relativePath));
}

/**
 * Resolve a tool-supplied path to a cwd-relative POSIX path, or undefined when it
 * escapes the working directory. A leading `@` is stripped the way built-in tools
 * do, because some models include it.
 */
export function resolveScopedPath(cwd: string, requested: string) {
  const cleaned = requested.startsWith("@") ? requested.slice(1) : requested;
  if (!cleaned.trim()) return undefined;
  const root = canonicalize(resolve(cwd));
  const target = canonicalize(resolve(cwd, cleaned));
  const rel = relative(root, target);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return rel.split(sep).join("/");
}

/** Decide whether a write may proceed, returning the denial reason when it may not. */
export function checkWriteScope(cwd: string, requested: string, globs: readonly string[]) {
  const relativePath = resolveScopedPath(cwd, requested);
  if (relativePath === undefined) {
    return { allowed: false as const, reason: `Path "${requested}" is outside the workflow cwd.` };
  }
  if (!matchesWriteScope(relativePath, globs)) {
    return {
      allowed: false as const,
      reason:
        `Path "${relativePath}" is outside this agent's writeScope (${globs.join(", ")}). ` +
        "Another agent may own that area of the tree.",
    };
  }
  return { allowed: true as const };
}
