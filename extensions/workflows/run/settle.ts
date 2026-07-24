import type { ArtifactStore } from "../artifacts/index.ts";
import type { SandboxRunner } from "../sandbox/index.ts";
import type { Layer } from "effect";
import type { RunRuntime } from "./runtime.ts";
import type { PreparedWorkflowScript } from "../scripting/index.ts";
import { incompletePhases } from "./incomplete.ts";
import { gateStatus } from "./required-resolution.ts";
import { runWorkflowScript } from "./script.ts";

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 16 * 1024);
export async function settleRun(
  runtime: RunRuntime,
  prepared: PreparedWorkflowScript,
  args: unknown,
  layer: Layer.Layer<ArtifactStore | SandboxRunner>,
) {
  let status: "completed" | "failed" | "aborted" = "completed";
  try {
    const result = await runWorkflowScript(runtime, prepared, args, layer);
    runtime.state.update((details) => {
      details.result = result;
    });
  } catch (error) {
    runtime.state.update((details) => {
      details.error = errorText(error);
    });
    status = runtime.controller.signal.aborted ? "aborted" : "failed";
    runtime.controller.abort("Workflow script failed");
  }
  // A failed gate is the run's real cause of death. It must outrank both the
  // generic abort message and a script that raced to a return before the kill.
  const gate = runtime.state.snapshot().requiredFailure;
  status = gateStatus(status, gate);
  if (gate) {
    runtime.state.update((details) => {
      details.error = gate;
    });
  }
  const settled = await runtime.controller.settle({ abort: status !== "completed" });
  runtime.state.update((details) => {
    if (!settled) {
      status = "failed";
      details.error = details.error
        ? `${details.error}; agent shutdown deadline exceeded`
        : "Agent shutdown deadline exceeded";
    }
    for (const record of details.agents) {
      if (record.state !== "running") continue;
      record.state = "error";
      record.error ??= "Agent did not settle before run cleanup";
      record.finishedAt = Date.now();
    }
    const incomplete = incompletePhases(details);
    if (incomplete.length > 0) details.incompletePhases = incomplete;
    details.status = status;
    details.finishedAt = Date.now();
  });
  try {
    runtime.persistence.flush();
  } catch (error) {
    const message = `Artifact persistence failed: ${errorText(error)}`;
    runtime.state.update((details) => {
      details.status = "failed";
      details.error = message;
    });
    throw new Error(message);
  }
}
