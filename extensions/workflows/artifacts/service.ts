import { Context, Effect, Layer } from "effect";
import type { WorkflowDetails } from "../run/types.ts";
import { persistWorkflowJson } from "./persist.ts";

export interface ArtifactStoreShape {
  save(runDir: string, details: WorkflowDetails): Effect.Effect<void, Error>;
}

export class ArtifactStore extends Context.Service<ArtifactStore, ArtifactStoreShape>()(
  "@dreki-gg/pi-workflows/ArtifactStore",
) {
  static readonly layer = Layer.succeed(ArtifactStore, {
    save: (runDir, details) =>
      Effect.try({
        try: () => persistWorkflowJson(runDir, details),
        catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      }),
  });
}
