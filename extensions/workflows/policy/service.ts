import { isSafeCommand } from "@dreki-gg/pi-command-sandbox";
import { Context, Effect, Layer } from "effect";
import type { CommandDecision, WriteFence } from "./decision.ts";
import { NEVER_ALLOWED_PATTERNS } from "./deny.ts";
import { explainDenial } from "./explain.ts";
import { decideFencedCommand, parseFencedCommand } from "./fenced.ts";
import { compileAllowPatterns } from "./patterns.ts";

export type { CommandDecision, WriteFence } from "./decision.ts";

export interface CommandPolicyShape {
  /**
   * Decide whether a governed agent may run a shell command.
   *
   * `allowCommands` widens the read-only baseline for verification gates such as
   * `npm run build`, which the stock safe-pattern list rejects. Redirects and
   * command substitution stay blocked, every segment of a chained command must
   * pass independently, and NEVER_ALLOWED_PATTERNS cannot be widened at all.
   *
   * `fence`, when supplied, permits the mutating commands a write-scoped agent
   * needs — `git mv` and `mkdir` — for paths inside it. Nothing else changes.
   */
  check(command: string, allowCommands?: readonly string[], fence?: WriteFence): CommandDecision;
}

export class CommandPolicy extends Context.Service<CommandPolicy, CommandPolicyShape>()(
  "@dreki-gg/pi-workflows/CommandPolicy",
) {
  static readonly layer = Layer.succeed(CommandPolicy, {
    check(command, allowCommands, fence) {
      // Fenced mutations are ruled on first so their denial can name the actual
      // problem (a forbidden flag, a path outside the fence) instead of the
      // generic read-only message.
      const fenced = parseFencedCommand(command);
      if (fenced.recognized) return decideFencedCommand(fenced, fence);
      let extraSafe: RegExp[];
      try {
        extraSafe = compileAllowPatterns(allowCommands ?? []);
      } catch (cause) {
        return { allowed: false, reason: cause instanceof Error ? cause.message : String(cause) };
      }
      // extraDestructive is evaluated before safe patterns, so the deny list wins.
      const options = { extraSafe, extraDestructive: NEVER_ALLOWED_PATTERNS };
      if (isSafeCommand(command, options)) return { allowed: true };
      return { allowed: false, reason: explainDenial(command, options) };
    },
  });
}

/** Synchronous helper for callers outside an Effect (tool wrappers, tests). */
export const checkCommand = (
  command: string,
  allowCommands?: readonly string[],
  fence?: WriteFence,
) =>
  Effect.runSync(
    Effect.gen(function* () {
      const policy = yield* CommandPolicy;
      return policy.check(command, allowCommands, fence);
    }).pipe(Effect.provide(CommandPolicy.layer)),
  );
