import { Effect, type Layer } from "effect";
import { SandboxRunner } from "../sandbox/index.ts";
import type { PreparedWorkflowScript } from "../scripting/index.ts";
import { compact } from "../shared/compact.ts";
import { createAgentCall } from "./agent-call.ts";
import type { RunRuntime } from "./runtime.ts";

export interface ScriptInputs {
  args: unknown;
  /** A previous run's returned value, already read and bounded. */
  previousJson?: string;
}

export async function runWorkflowScript(
  runtime: RunRuntime,
  prepared: PreparedWorkflowScript,
  inputs: ScriptInputs,
  layer: Layer.Layer<SandboxRunner>,
) {
  const onAgent = createAgentCall(runtime);
  const program = Effect.gen(function* () {
    const sandbox = yield* SandboxRunner;
    return yield* sandbox.run({
      ...compact({ previousJson: inputs.previousJson }),
      source: prepared.source,
      args: inputs.args,
      cwd: runtime.context.cwd,
      signal: runtime.controller.signal,
      onAgent,
      onPhase(title) {
        runtime.state.update((details) => {
          details.currentPhase = title;
          if (!details.phases.some((phase) => phase.title === title)) {
            details.phases.push({ title });
          }
        });
        runtime.persistence.checkpoint();
        runtime.emit();
      },
    });
  }).pipe(Effect.provide(layer));
  return Effect.runPromise(program);
}
