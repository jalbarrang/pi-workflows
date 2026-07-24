import { createWorkflowResources, runAgent } from "../agent/index.ts";
import { unknownOptionKeyError } from "../sandbox/index.ts";
import { createAgentRecord, failRecord } from "./agent-record.ts";
import { resolveAgentOptions } from "./agent-options.ts";
import type { AgentCallOptions, ScriptAgentResult } from "./input.ts";
import { PREVIEW_LENGTH } from "./limits.ts";
import type { RunRuntime } from "./runtime.ts";

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 16 * 1024);

export function createAgentCall(runtime: RunRuntime) {
  return async (
    promptValue: unknown,
    optionsValue: unknown = {},
    invocation?: AbortSignal,
    unknownKeys: readonly string[] = [],
  ): Promise<ScriptAgentResult> => {
    const options =
      optionsValue && typeof optionsValue === "object" ? (optionsValue as AgentCallOptions) : {};
    const record = createAgentRecord(runtime, options);
    const fail = (message: string) => failRecord(runtime, record, message);
    const prompt = typeof promptValue === "string" ? promptValue : String(promptValue ?? "");
    if (!prompt.trim()) return fail("agent() requires a non-empty prompt string");
    if (unknownKeys.length > 0) return fail(unknownOptionKeyError(record.label, unknownKeys));
    // Every option is validated before scheduling, so a misconfigured call costs
    // neither a concurrency permit nor a unit of the run's call budget.
    const { resolved, error } = resolveAgentOptions(
      options,
      runtime.context,
      runtime.pi.getThinkingLevel(),
    );
    if (error || !resolved) return fail(`agent "${record.label}": ${error ?? "invalid options"}`);
    if (runtime.controller.signal.aborted) {
      return fail("Workflow was aborted before this agent started");
    }
    runtime.state.update(() => {
      record.model = resolved.model?.id;
      record.contextWindow = resolved.model?.contextWindow;
    });
    runtime.persistence.checkpoint();
    runtime.emit();
    return runtime.controller
      .schedule(async (signal) => {
        const resources = await createWorkflowResources(
          runtime.context.cwd,
          options.schema === undefined ? "plain" : "structured",
          runtime.context.isProjectTrusted(),
        );
        const outcome = await runAgent({
          prompt,
          schema: options.schema,
          model: resolved.model,
          thinkingLevel: resolved.thinkingLevel,
          toolCallTimeoutMs: resolved.toolCallTimeoutMs,
          readOnly: resolved.readOnly,
          policyGoverned: resolved.policyGoverned,
          ...(resolved.writeScope ? { writeScope: resolved.writeScope } : {}),
          ...(resolved.allowCommands ? { allowCommands: resolved.allowCommands } : {}),
          checkCommand: runtime.checkCommand,
          cwd: runtime.context.cwd,
          loader: resources.loader,
          settingsManager: resources.settingsManager,
          modelRegistry: runtime.context.modelRegistry,
          signal,
          onProgress(progress) {
            runtime.state.update(() => {
              record.preview = progress.preview.slice(0, PREVIEW_LENGTH);
              record.usage = progress.usage;
              record.model = progress.model ?? record.model;
              record.contextWindow = progress.contextWindow ?? record.contextWindow;
              record.transcript = progress.transcript;
            });
            runtime.persistence.checkpoint();
            runtime.emit();
          },
        });
        runtime.state.update(() => {
          record.usage = outcome.usage;
          record.model = outcome.model ?? record.model;
          record.contextWindow = outcome.contextWindow ?? record.contextWindow;
          record.transcript = outcome.transcript;
          record.preview = (outcome.output || record.preview).slice(0, PREVIEW_LENGTH);
          record.finishedAt = Date.now();
          record.state = outcome.ok ? "done" : "error";
          record.error = outcome.ok ? undefined : (outcome.error ?? "Agent failed");
        });
        runtime.persistence.checkpoint();
        runtime.emit();
        return {
          ok: outcome.ok,
          output: outcome.output,
          ...(outcome.structured === undefined ? {} : { structured: outcome.structured }),
          ...(outcome.error === undefined ? {} : { error: outcome.error }),
        };
      }, invocation)
      .catch((error) => fail(errorText(error)));
  };
}
