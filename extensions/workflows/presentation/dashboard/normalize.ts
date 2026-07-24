import type { AgentRecord, TranscriptEntry } from "../../run/types.ts";
import { emptyUsage } from "../../run/usage.ts";

export function normalizeTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const roles = ["user", "assistant", "thinking", "tool", "toolResult"];
    if (!roles.includes(String(entry.role)) || typeof entry.text !== "string") return [];
    return [
      {
        role: entry.role as TranscriptEntry["role"],
        text: entry.text,
        name: typeof entry.name === "string" ? entry.name : undefined,
        toolCallId: typeof entry.toolCallId === "string" ? entry.toolCallId : undefined,
        isError: entry.isError === true,
        timestamp: typeof entry.timestamp === "number" ? entry.timestamp : undefined,
        startedAt: typeof entry.startedAt === "number" ? entry.startedAt : undefined,
        finishedAt: typeof entry.finishedAt === "number" ? entry.finishedAt : undefined,
        durationMs: typeof entry.durationMs === "number" ? entry.durationMs : undefined,
      },
    ];
  });
}

export function normalizeAgent(
  value: unknown,
  index: number,
  startedAt: number,
): AgentRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const agent = value as Record<string, unknown>;
  const state =
    agent.state === "error" || agent.state === "failed"
      ? "error"
      : agent.state === "running"
        ? "running"
        : "done";
  return {
    index: typeof agent.index === "number" ? agent.index : index + 1,
    label: typeof agent.label === "string" ? agent.label : `agent-${index + 1}`,
    phase: typeof agent.phase === "string" ? agent.phase : undefined,
    state,
    model: typeof agent.model === "string" ? agent.model : undefined,
    contextWindow:
      typeof agent.contextWindow === "number" &&
      Number.isFinite(agent.contextWindow) &&
      agent.contextWindow > 0
        ? agent.contextWindow
        : undefined,
    startedAt: typeof agent.startedAt === "number" ? agent.startedAt : startedAt,
    finishedAt: typeof agent.finishedAt === "number" ? agent.finishedAt : undefined,
    error:
      typeof agent.error === "string" && agent.error !== "[undefined]" ? agent.error : undefined,
    preview: typeof agent.preview === "string" ? agent.preview : "",
    usage: { ...emptyUsage(), ...(typeof agent.usage === "object" ? agent.usage : {}) },
    transcript: normalizeTranscript(agent.transcript),
  };
}
