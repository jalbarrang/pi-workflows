import type { Layer } from "effect";
import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { ArtifactStore } from "../artifacts/index.ts";
import type { CommandPolicy } from "../policy/index.ts";
import {
  backgroundFollowUp,
  backgroundLaunch,
  buildWorkflowResultMessage,
} from "../presentation/result-text.ts";
import { SandboxRunner } from "../sandbox/index.ts";
import { prepareWorkflowScript } from "../scripting/index.ts";
import type { WorkflowInput } from "./input.ts";
import { prepareRun } from "./prepare.ts";
import { compactToolDetails, parseArgs } from "./result.ts";
import { settleRun } from "./settle.ts";
import type { ActiveRun, WorkflowDetails } from "./types.ts";

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 16 * 1024);
export interface ExecuteHooks {
  settled(status: "completed" | "failed" | "aborted"): void;
  changed(): void;
}
export async function executeWorkflow(
  pi: ExtensionAPI,
  input: WorkflowInput,
  signal: AbortSignal,
  update: AgentToolUpdateCallback<WorkflowDetails> | undefined,
  context: ExtensionContext,
  active: Map<string, ActiveRun>,
  layer: Layer.Layer<ArtifactStore | SandboxRunner | CommandPolicy>,
  hooks: ExecuteHooks,
) {
  let prepared;
  try {
    prepared = prepareWorkflowScript(input.script);
  } catch (error) {
    throw new Error(`Workflow script failed to parse: ${errorText(error)}`);
  }
  const run = await prepareRun(pi, input, prepared, signal, update, context, layer);
  const activeRun: ActiveRun = {
    get details() {
      return run.runtime.state.snapshot();
    },
    controller: run.runtime.controller,
  };
  active.set(run.runId, activeRun);
  const completion = settleRun(run.runtime, prepared, parseArgs(input.args), layer).finally(() => {
    run.progress.flush();
  });
  activeRun.completion = completion;
  hooks.changed();
  if (run.background) {
    void completion
      .catch((error) => {
        run.runtime.state.update((details) => {
          details.status = "failed";
          details.finishedAt = Date.now();
          details.error ??= errorText(error);
        });
      })
      .finally(() => {
        const details = run.runtime.state.snapshot();
        active.delete(run.runId);
        hooks.settled(details.status === "running" ? "failed" : details.status);
        hooks.changed();
        try {
          pi.sendUserMessage(backgroundFollowUp(details, run.runDir), { deliverAs: "followUp" });
        } catch {}
      });
    const details = run.runtime.state.snapshot();
    return {
      content: [{ type: "text" as const, text: backgroundLaunch(details, run.runDir) }],
      details: compactToolDetails(details),
    };
  }
  try {
    await completion;
  } finally {
    const details = run.runtime.state.snapshot();
    active.delete(run.runId);
    hooks.settled(details.status === "running" ? "failed" : details.status);
    hooks.changed();
  }
  const details = run.runtime.state.snapshot();
  const message = buildWorkflowResultMessage(details, run.runDir);
  if (details.status !== "completed") throw new Error(message);
  return {
    content: [{ type: "text" as const, text: message }],
    details: compactToolDetails(details),
  };
}
