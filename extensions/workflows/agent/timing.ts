import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { truncateUtf8 } from "../artifacts/index.ts";
import type { ToolExecutionTiming } from "./types.ts";

type TimingEvent = Extract<
  AgentSessionEvent,
  { type: "tool_execution_start" | "tool_execution_end" }
>;
export function recordToolExecutionTiming(
  timings: Map<string, ToolExecutionTiming>,
  event: TimingEvent,
  observedAt = Date.now(),
) {
  const previous = timings.get(event.toolCallId);
  if (event.type === "tool_execution_start") {
    if (previous?.startedAt !== undefined) return;
    timings.set(event.toolCallId, { ...previous, startedAt: observedAt });
    return;
  }
  if (previous?.finishedAt !== undefined) return;
  const durationMs =
    previous?.startedAt === undefined ? undefined : Math.max(0, observedAt - previous.startedAt);
  timings.set(event.toolCallId, {
    ...previous,
    finishedAt: observedAt,
    ...(durationMs === undefined ? {} : { durationMs }),
  });
}

export function toolMetadata(
  toolCallId: string,
  timings: ReadonlyMap<string, ToolExecutionTiming>,
) {
  const timing = timings.get(toolCallId);
  return {
    toolCallId: truncateUtf8(toolCallId, 1_024),
    ...(timing?.startedAt === undefined ? {} : { startedAt: timing.startedAt }),
    ...(timing?.finishedAt === undefined ? {} : { finishedAt: timing.finishedAt }),
    ...(timing?.durationMs === undefined ? {} : { durationMs: timing.durationMs }),
  };
}
