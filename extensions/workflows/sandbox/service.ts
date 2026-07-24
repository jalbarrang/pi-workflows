import { Context, Effect, Layer } from "effect";
import { runWorkflowSandbox } from "./runner.ts";
import type { RunWorkflowSandboxOptions } from "./types.ts";

export interface SandboxRunnerShape {
  run(options: RunWorkflowSandboxOptions): Effect.Effect<unknown, Error>;
}

export class SandboxRunner extends Context.Service<SandboxRunner, SandboxRunnerShape>()(
  "@dreki-gg/pi-workflows/SandboxRunner",
) {
  static readonly layer = Layer.succeed(SandboxRunner, {
    run: (options) =>
      Effect.tryPromise({
        try: () => runWorkflowSandbox(options),
        catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      }),
  });
}
