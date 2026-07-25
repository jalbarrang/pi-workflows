import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { backgroundFollowUp, backgroundLaunch } from "../presentation/result-text.ts";
import { compactToolDetails } from "./result.ts";
import type { RunRuntime } from "./runtime.ts";
import type { ActiveRun } from "./types.ts";

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 16 * 1024);

export interface BackgroundHooks {
  settled(status: "completed" | "failed" | "aborted"): void;
  changed(): void;
}

/**
 * Hand a background run off and return its launch acknowledgement.
 *
 * The tool call returns immediately, so every terminal path has to be handled
 * here: a rejected completion still has to mark the run failed, deregister it, and
 * deliver a follow-up, because nothing is awaiting it.
 */
export function launchInBackground(
  pi: ExtensionAPI,
  context: {
    runId: string;
    runDir: string;
    runtime: RunRuntime;
    completion: Promise<void>;
    active: Map<string, ActiveRun>;
    hooks: BackgroundHooks;
  },
) {
  const { runId, runDir, runtime, completion, active, hooks } = context;
  void completion
    .catch((error) => {
      runtime.state.update((details) => {
        details.status = "failed";
        details.finishedAt = Date.now();
        details.error ??= errorText(error);
      });
    })
    .finally(() => {
      const details = runtime.state.snapshot();
      active.delete(runId);
      hooks.settled(details.status === "running" ? "failed" : details.status);
      hooks.changed();
      try {
        pi.sendUserMessage(backgroundFollowUp(details, runDir), { deliverAs: "followUp" });
      } catch {}
    });
  const details = runtime.state.snapshot();
  return {
    content: [{ type: "text" as const, text: backgroundLaunch(details, runDir) }],
    details: compactToolDetails(details),
  };
}
