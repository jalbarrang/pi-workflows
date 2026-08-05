import type { AgentOutcome } from "../agent/index.ts";
import { compact } from "../shared/compact.ts";
import { artifactFields } from "./agent-artifacts.ts";
import type { ScriptAgentResult } from "./input.ts";
import { PREVIEW_LENGTH } from "./limits.ts";
import type { RunRuntime } from "./runtime.ts";
import type { AgentRecord } from "./types.ts";

/**
 * Stop the run because a gate agent failed.
 *
 * The reason is recorded before the abort so `settleRun` can report the gate as
 * the cause of death: an abort alone would read as a user cancellation, and the
 * script racing to a `return` would otherwise read as a clean completion. An
 * already-aborted run is left alone, because a real cancellation must not be
 * relabelled as a gate failure.
 */
export function abortForFailedGate(runtime: RunRuntime, record: AgentRecord, error: string) {
  if (runtime.controller.signal.aborted) return;
  const message = `Required agent "${record.label}" failed: ${error}`;
  runtime.state.update((details) => {
    details.requiredFailure ??= message;
  });
  runtime.controller.abort(message);
}

/** Project a finished agent onto its record and into the script-visible result. */
export function applyAgentOutcome(
  runtime: RunRuntime,
  record: AgentRecord,
  outcome: AgentOutcome,
  required: boolean,
): ScriptAgentResult {
  const artifacts = artifactFields(outcome);
  runtime.state.update(() => {
    record.outputFile = artifacts.outputFile;
    record.structuredFile = artifacts.structuredFile;
    record.outputBytes = artifacts.outputBytes;
    record.usage = outcome.usage;
    record.model = outcome.model ?? record.model;
    record.contextWindow = outcome.contextWindow ?? record.contextWindow;
    record.transcript = outcome.transcript;
    record.preview = (outcome.output || record.preview).slice(0, PREVIEW_LENGTH);
    record.finishedAt = Date.now();
    record.state = outcome.ok ? "done" : "error";
    record.error = outcome.ok ? undefined : (outcome.error ?? "Agent failed");
    record.deliveryError = outcome.deliveryError;
  });
  runtime.persistence.checkpoint();
  runtime.emit();
  if (!outcome.ok && required) {
    abortForFailedGate(runtime, record, outcome.error ?? "Agent failed");
  }
  return compact({
    ok: outcome.ok,
    output: outcome.output,
    ...artifacts,
    structured: outcome.structured,
    error: outcome.error,
    deliveryError: outcome.deliveryError,
  });
}
