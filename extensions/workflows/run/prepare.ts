import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { Effect, type Layer } from "effect";
import {
  getAgentDir,
  type AgentToolUpdateCallback,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  ArtifactStore,
  createWorkflowPersistence,
  sweepRunDirectories,
  writeFileAtomic,
} from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";
import type { PreparedWorkflowScript } from "../scripting/index.ts";
import { RunController } from "./controller.ts";
import type { WorkflowInput } from "./input.ts";
import { createProgressEmitter } from "./progress.ts";
import type { RunRuntime } from "./runtime.ts";
import { preflightWorkflowScript } from "./script-preflight.ts";
import { WorkflowState } from "./state.ts";
import type { WorkflowDetails } from "./types.ts";

export async function prepareRun(
  pi: ExtensionAPI,
  input: WorkflowInput,
  prepared: PreparedWorkflowScript,
  signal: AbortSignal,
  update: AgentToolUpdateCallback<WorkflowDetails> | undefined,
  context: ExtensionContext,
  layer: Layer.Layer<ArtifactStore>,
  activeRunIds: Iterable<string> = [],
) {
  // Reject statically decidable authoring mistakes before any run directory,
  // artifact, or agent exists. Dynamic values still use exact runtime validation.
  const scriptError = preflightWorkflowScript(prepared.source, context, pi.getThinkingLevel());
  if (scriptError) throw new Error(scriptError);
  const runId = `wf_${randomBytes(6).toString("hex")}`;
  const workflowsDir = path.join(getAgentDir(), "workflows");
  // Sweep before this run writes anything and protect every active run so the sweep cannot race atomic writes.
  sweepRunDirectories(workflowsDir, { protect: activeRunIds });
  const runDir = path.join(workflowsDir, runId);
  const details: WorkflowDetails = compact({
    runId,
    sessionId: context.sessionManager.getSessionId(),
    name: prepared.meta.name,
    description: prepared.meta.description,
    status: "running",
    startedAt: Date.now(),
    phases: [...prepared.meta.phases],
    agents: [],
    resumedFrom: input.resume,
  });
  writeFileAtomic(path.join(runDir, "script.js"), input.script);
  if (input.args !== undefined) writeFileAtomic(path.join(runDir, "args.json"), input.args);
  const store = await Effect.runPromise(ArtifactStore.pipe(Effect.provide(layer)));
  const persist = (directory: string, current: WorkflowDetails) => {
    Effect.runSync(store.save(directory, current));
  };
  persist(runDir, details);
  const state = new WorkflowState(details);
  const persistence = createWorkflowPersistence(runDir, details, { persist });
  const controller = new RunController(signal);
  const progress = createProgressEmitter(() => state.snapshot(), update);
  const runtime: RunRuntime = {
    pi,
    context,
    controller,
    state,
    persistence,
    runDir,
    emit: progress.emit,
  };
  return { runId, runDir, runtime, progress };
}
