import { truncateUtf8 } from "../artifacts/index.ts";
import { emptyUsage } from "../run/usage.ts";
import { createWorkflowSession } from "./create-session.ts";
import { observeSession } from "./observe.ts";
import { classifyAgentOutcome } from "./outcome.ts";
import { shutdownChildSession } from "./shutdown.ts";
import { transcriptFromMessages } from "./transcript.ts";
import type { AgentOutcome, RunAgentOptions } from "./types.ts";
import { finalOutput } from "./usage.ts";
import { createFirstResponseWatchdog } from "./watchdog.ts";

const OUTPUT_MAX_BYTES = 64 * 1024;
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
  const { session, structured, denied, stopGuard } = created;
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
      await watchdog.waitFor(session.prompt(options.prompt));
    }
  } catch (cause) {
    caught = errorText(cause);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    if (abortPromise) await abortPromise;
    observer.unsubscribe();
    stopGuard();
  }
  const projection = observer.projection();
  const output = truncateUtf8(finalOutput(session.messages), OUTPUT_MAX_BYTES);
  const transcript = transcriptFromMessages(session.messages, observer.timings);
  await shutdownChildSession(session);
  const deniedCommands = denied();
  const base = {
    output,
    ...(deniedCommands.length > 0 ? { deniedCommands } : {}),
    usage: projection.usage,
    model: projection.model,
    contextWindow: projection.contextWindow,
    transcript,
  };
  const verdict = classifyAgentOutcome({
    aborted,
    stopReason: projection.stopReason,
    caught,
    projectionError: projection.error,
    schemaRequested: options.schema !== undefined,
    hasStructured: structured() !== undefined,
  });
  return { ...base, ...verdict, structured: structured() };
}
