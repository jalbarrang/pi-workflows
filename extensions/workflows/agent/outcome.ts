/** Everything the runner knows about how a child session ended. */
export interface OutcomeSignals {
  /** The run or the caller cancelled this agent. */
  aborted: boolean;
  /** Set when this agent's own wall-clock deadline fired. */
  durationExceededMs?: number;
  stopReason?: string;
  /** Thrown out of `session.prompt()` — typically a transport fault. */
  caught?: string;
  /** Error reported on the last assistant message. */
  projectionError?: string;
  schemaRequested: boolean;
  /** A terminating `structured_output` call was recorded and validated. */
  hasStructured: boolean;
}

export interface OutcomeVerdict {
  ok: boolean;
  aborted: boolean;
  error?: string;
  /**
   * A transport fault that arrived after the work was already recorded. Present
   * only on an `ok: true` verdict, so a reader can see the run was salvaged.
   */
  deliveryError?: string;
}

const MISSING_STRUCTURED =
  "Agent finished without calling structured_output; no matching structured result was produced.";

/**
 * Decide whether an agent succeeded, separating *work* failures from *delivery*
 * failures.
 *
 * A schema-bearing agent that has already called the terminating
 * `structured_output` tool has finished its work: the result is validated and
 * durably captured in the transcript. If the socket then drops on the way out,
 * that is a delivery failure, and collapsing the two throws away a complete,
 * paid-for answer — observed in run `wf_e45f788c8902`, where a review agent's
 * findings were recorded and then discarded because teardown died, and the
 * re-run reproduced the identical finding at cost.
 *
 * An abort stays fatal: cancellation is intentional, and a partially-recorded
 * result from a cancelled agent is not something a script should silently trust.
 */
export function classifyAgentOutcome(signals: OutcomeSignals): OutcomeVerdict {
  if (signals.durationExceededMs !== undefined) {
    return {
      ok: false,
      aborted: false,
      error: `Agent exceeded maxDurationMs of ${signals.durationExceededMs} ms`,
    };
  }
  if (signals.aborted || signals.stopReason === "aborted") {
    return { ok: false, aborted: true, error: "Agent was aborted" };
  }
  const failure =
    signals.caught ??
    signals.projectionError ??
    (signals.stopReason === "error" ? "Agent failed" : undefined);
  if (failure !== undefined) {
    if (signals.schemaRequested && signals.hasStructured) {
      return { ok: true, aborted: false, deliveryError: failure };
    }
    return { ok: false, aborted: false, error: failure };
  }
  if (signals.schemaRequested && !signals.hasStructured) {
    return { ok: false, aborted: false, error: MISSING_STRUCTURED };
  }
  return { ok: true, aborted: false };
}
