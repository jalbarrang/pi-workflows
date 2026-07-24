import type { AgentCallOptions } from "./input.ts";
import type { AgentRecord } from "./types.ts";
import { emptyUsage } from "./usage.ts";
import type { RunRuntime } from "./runtime.ts";

export function createAgentRecord(runtime: RunRuntime, options: AgentCallOptions) {
  const index = runtime.state.nextAgentIndex();
  const details = runtime.state.snapshot();
  const label =
    typeof options.label === "string" && options.label.trim()
      ? options.label.trim().slice(0, 160)
      : `agent-${index}`;
  const record: AgentRecord = {
    index,
    label,
    phase: typeof options.phase === "string" ? options.phase.slice(0, 160) : details.currentPhase,
    state: "running",
    model: runtime.context.model?.id,
    contextWindow: runtime.context.model?.contextWindow,
    startedAt: Date.now(),
    preview: "",
    usage: emptyUsage(),
    transcript: [],
  };
  runtime.state.addAgent(record);
  runtime.persistence.checkpoint({ immediate: true });
  runtime.emit();
  return record;
}

export function failRecord(runtime: RunRuntime, record: AgentRecord, error: string) {
  runtime.state.update(() => {
    record.state = "error";
    record.error = error;
    record.finishedAt = Date.now();
  });
  runtime.persistence.checkpoint();
  runtime.emit();
  return { ok: false as const, output: "", error };
}
