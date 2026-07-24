import { Effect, type Layer } from "effect";
import { SandboxRunner } from "../sandbox/index.ts";
import type { PreparedWorkflowScript } from "../scripting/index.ts";
import { createAgentCall } from "./agent-call.ts";
import type { RunRuntime } from "./runtime.ts";

export async function runWorkflowScript(
  runtime: RunRuntime,
  prepared: PreparedWorkflowScript,
  args: unknown,
  layer: Layer.Layer<SandboxRunner>,
) {
  const onAgent = createAgentCall(runtime);
  const program = Effect.gen(function* () {
    const sandbox = yield* SandboxRunner;
    return yield* sandbox.run({
      source: prepared.source,
      args,
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
