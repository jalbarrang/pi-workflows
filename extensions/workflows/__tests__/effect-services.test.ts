import assert from "node:assert/strict";
import { test } from "node:test";
import { Effect, Layer } from "effect";
import { ArtifactStore } from "../artifacts/index.ts";
import { SandboxRunner } from "../sandbox/index.ts";
import { WorkflowServicesLayer } from "../run/services.ts";

const program = Effect.gen(function* () {
  const sandbox = yield* SandboxRunner;
  const artifacts = yield* ArtifactStore;
  return { sandbox: sandbox.run, artifacts: artifacts.save };
});
test("production layer provides SandboxRunner and ArtifactStore services", async () => {
  const services = await Effect.runPromise(program.pipe(Effect.provide(WorkflowServicesLayer)));
  assert.equal(typeof services.sandbox, "function");
  assert.equal(typeof services.artifacts, "function");
});
test("service seams accept test layers", async () => {
  const testLayer = Layer.merge(
    Layer.succeed(SandboxRunner, { run: () => Effect.succeed("sandbox") }),
    Layer.succeed(ArtifactStore, { save: () => Effect.void }),
  );
  const services = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  assert.equal(typeof services.sandbox, "function");
  assert.equal(typeof services.artifacts, "function");
});
