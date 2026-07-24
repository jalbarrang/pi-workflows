import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { Effect, type Layer } from "effect";
import {
  getAgentDir,
  type AgentToolUpdateCallback,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { ArtifactStore, createWorkflowPersistence, writeFileAtomic } from "../artifacts/index.ts";
import { CommandPolicy } from "../policy/index.ts";
import type { PreparedWorkflowScript } from "../scripting/index.ts";
import { RunController } from "./controller.ts";
import type { WorkflowInput } from "./input.ts";
import { preflightModels } from "./model-preflight.ts";
import { createProgressEmitter } from "./progress.ts";
import type { RunRuntime } from "./runtime.ts";
import { WorkflowState } from "./state.ts";
import type { WorkflowDetails } from "./types.ts";

export async function prepareRun(
  pi: ExtensionAPI,
  input: WorkflowInput,
  prepared: PreparedWorkflowScript,
  signal: AbortSignal,
  update: AgentToolUpdateCallback<WorkflowDetails> | undefined,
  context: ExtensionContext,
  layer: Layer.Layer<ArtifactStore | CommandPolicy>,
) {
  // Reject unknown models before any run directory, artifact, or agent exists.
  const unknownModels = preflightModels(prepared.source, context);
  if (unknownModels) throw new Error(unknownModels);
  const runId = `wf_${randomBytes(6).toString("hex")}`;
  const runDir = path.join(getAgentDir(), "workflows", runId);
  const background = !!input.background && context.hasUI;
  const details: WorkflowDetails = {
    runId,
    sessionId: context.sessionManager.getSessionId(),
    name: prepared.meta.name,
    description: prepared.meta.description,
    background,
    status: "running",
    startedAt: Date.now(),
    phases: [...prepared.meta.phases],
    agents: [],
  };
  writeFileAtomic(path.join(runDir, "script.js"), input.script);
  if (input.args !== undefined) writeFileAtomic(path.join(runDir, "args.json"), input.args);
  const services = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ArtifactStore;
      const policy = yield* CommandPolicy;
      return { store, policy };
    }).pipe(Effect.provide(layer)),
  );
  const store = services.store;
  const persist = (directory: string, current: WorkflowDetails) => {
    Effect.runSync(store.save(directory, current));
  };
  persist(runDir, details);
  const state = new WorkflowState(details);
  const persistence = createWorkflowPersistence(runDir, details, { persist });
  const controller = new RunController(background ? undefined : signal);
  const progress = createProgressEmitter(background, () => state.snapshot(), update);
  const runtime: RunRuntime = {
    pi,
    context,
    controller,
    state,
    persistence,
    checkCommand: services.policy.check,
    emit: progress.emit,
  };
  return { runId, runDir, background, runtime, progress };
}
