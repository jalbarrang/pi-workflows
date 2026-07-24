const MAX_ENTRIES = 20;
const MAX_COMMAND_CHARS = 400;

/**
 * Commands the policy refused during one agent run.
 *
 * Without this, "did nothing because nothing was needed" and "did nothing because
 * it was blocked" look identical to an orchestrator: the denial reaches the child
 * agent as an error tool result and dies there unless the model volunteers it. In
 * run `wf_502f35f143f6` two of three agents returned `ok: true` having changed
 * nothing, because the relocation they were asked for was denied silently.
 *
 * Deduplicated and capped: this is a signal for the orchestrator, not a log.
 */
export function createDeniedCommandLog() {
  const seen: string[] = [];
  return {
    record(command: string) {
      const trimmed = command.trim().slice(0, MAX_COMMAND_CHARS);
      if (!trimmed || seen.includes(trimmed) || seen.length >= MAX_ENTRIES) return;
      seen.push(trimmed);
    },
    list(): string[] {
      return [...seen];
    },
  };
}

export type DeniedCommandLog = ReturnType<typeof createDeniedCommandLog>;
