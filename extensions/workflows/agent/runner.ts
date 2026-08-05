import { truncateUtf8 } from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";
import { emptyUsage } from "../run/usage.ts";
import { createWorkflowSession } from "./create-session.ts";
import { createAgentDurationGuard } from "./duration.ts";
import { observeSession } from "./observe.ts";
import { classifyAgentOutcome } from "./outcome.ts";
import { shutdownChildSession } from "./shutdown.ts";
import { transcriptFromMessages } from "./transcript.ts";
import type { AgentOutcome, RunAgentOptions } from "./types.ts";
import { finalOutput } from "./usage.ts";
import { createFirstResponseWatchdog } from "./watchdog.ts";

/** Inline cap on the output string carried back over IPC. The on-disk artifact is not capped to this. */
export const OUTPUT_MAX_BYTES = 64 * 1024;
const errorText = (cause: unknown) =>
  (cause instanceof Error ? cause.message : String(cause)).slice(0, 16 * 1024);
export async function runAgent(options: RunAgentOptions): Promise<AgentOutcome> {
  let created;
  try {
    created = await createWorkflowSession(options);
  } catch (cause) {
    return {
      ok: false,
      output: "",
      error: `Failed to create agent session: ${errorText(cause)}`,
      aborted: false,
      usage: emptyUsage(),
      model: options.model?.id,
      contextWindow: options.model?.contextWindow,
      transcript: [],
    };
  }
  const { session, structured, stopGuard } = created;
  const duration = createAgentDurationGuard(() => session.abort(), options.maxDurationMs);
  const observer = observeSession(session, options);
  let aborted = false;
  let abortPromise: Promise<void> | undefined;
  const onAbort = () => {
    aborted = true;
    abortPromise ??= session.abort().catch(() => {});
  };
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });
  let caught: string | undefined;
  try {
    if (!aborted) {
      const watchdog = createFirstResponseWatchdog(() => session.abort(), {
        timeoutMs: options.firstResponseTimeoutMs,
        model: session.model?.id ?? options.model?.id,
      });
      observer.setMarkResponse(watchdog.markResponse);
      await duration.waitFor(watchdog.waitFor(session.prompt(options.prompt)));
    }
  } catch (cause) {
    caught = errorText(cause);
  } finally {
    duration.cancel();
    options.signal?.removeEventListener("abort", onAbort);
    if (duration.exceeded()) await session.abort().catch(() => {});
    if (abortPromise) await abortPromise;
    observer.unsubscribe();
    stopGuard();
  }
  const projection = observer.projection();
  // Persisted before truncation and before teardown: this is the only point where
  // the whole answer exists, and teardown is where runs have died with it.
  const full = finalOutput(session.messages);
  const artifacts = options.persistOutput?.({ output: full, structured: structured() });
  const output = truncateUtf8(full, OUTPUT_MAX_BYTES);
  const transcript = transcriptFromMessages(session.messages, observer.timings);
  await shutdownChildSession(session);
  const base = compact({
    output,
    ...artifacts,
    outputTruncated: output === full ? undefined : true,
    usage: projection.usage,
    model: projection.model,
    contextWindow: projection.contextWindow,
    transcript,
  });
  const verdict = classifyAgentOutcome({
    aborted,
    durationExceededMs: duration.exceeded() ? options.maxDurationMs : undefined,
    stopReason: projection.stopReason,
    caught,
    projectionError: projection.error,
    schemaRequested: options.schema !== undefined,
    hasStructured: structured() !== undefined,
  });
  return { ...base, ...verdict, structured: structured() };
}
