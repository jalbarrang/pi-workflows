import { isSafeCommand } from "@dreki-gg/pi-command-sandbox";
import { Context, Effect, Layer } from "effect";
import { NEVER_ALLOWED_PATTERNS } from "./deny.ts";
import { compileAllowPatterns } from "./patterns.ts";
import { parseRelocation } from "./relocate.ts";

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
export interface RelocationFence {
  inScope(path: string): boolean;
  describe(): string;
}

export interface CommandPolicyShape {
  /**
   * Decide whether a scoped agent may run a shell command.
   *
   * `allowCommands` widens the read-only baseline for verification gates such as
   * `npm run build`, which the stock safe-pattern list rejects. Redirects and
   * command substitution stay blocked, every segment of a chained command must
   * pass independently, and NEVER_ALLOWED_PATTERNS cannot be widened at all.
   *
   * `fence`, when supplied, permits a bare `git mv` whose two operands both land
   * inside it. Nothing else about the baseline changes.
   */
  check(
    command: string,
    allowCommands?: readonly string[],
    fence?: RelocationFence,
  ): CommandDecision;
}

export class CommandPolicy extends Context.Service<CommandPolicy, CommandPolicyShape>()(
  "@dreki-gg/pi-workflows/CommandPolicy",
) {
  static readonly layer = Layer.succeed(CommandPolicy, {
    check(command, allowCommands, fence) {
      const relocation = parseRelocation(command);
      if (relocation && fence) {
        const outside = [relocation.source, relocation.destination].filter(
          (path) => !fence.inScope(path),
        );
        if (outside.length === 0) return { allowed: true };
        return {
          allowed: false,
          reason:
            `"${command}" would move ${outside.join(" and ")} outside this agent's ` +
            `writeScope (${fence.describe()}). A relocation is permitted only when both ` +
            "paths are inside the fence.",
        };
      }
      let extraSafe: RegExp[];
      try {
        extraSafe = compileAllowPatterns(allowCommands ?? []);
      } catch (cause) {
        return { allowed: false, reason: cause instanceof Error ? cause.message : String(cause) };
      }
      // extraDestructive is evaluated before safe patterns, so the deny list wins.
      const options = { extraSafe, extraDestructive: NEVER_ALLOWED_PATTERNS };
      if (isSafeCommand(command, options)) return { allowed: true };
      return {
        allowed: false,
        reason:
          `Command "${command}" is not permitted for a read-only workflow agent. ` +
          "Allowed commands are read-only by default; widen them with allowCommands.",
      };
    },
  });
}

/** Synchronous helper for callers outside an Effect (tool wrappers, tests). */
export const checkCommand = (
  command: string,
  allowCommands?: readonly string[],
  fence?: RelocationFence,
) =>
  Effect.runSync(
    Effect.gen(function* () {
      const policy = yield* CommandPolicy;
      return policy.check(command, allowCommands, fence);
    }).pipe(Effect.provide(CommandPolicy.layer)),
  );
