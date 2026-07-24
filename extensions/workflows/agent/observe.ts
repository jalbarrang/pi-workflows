import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { transcriptFromMessages } from "./transcript.ts";
import { recordToolExecutionTiming } from "./timing.ts";
import type { RunAgentOptions, ToolExecutionTiming } from "./types.ts";
import { finalOutput } from "./usage.ts";
import { projectSession, type SessionProjection } from "./session-state.ts";

function assistantEvent(event: AgentSessionEvent) {
  return (
    ["message_start", "message_update", "message_end"].includes(event.type) &&
    "message" in event &&
    event.message.role === "assistant"
  );
}

export function observeSession(session: AgentSession, options: RunAgentOptions) {
  const timings = new Map<string, ToolExecutionTiming>();
  let projection: SessionProjection = projectSession(session, options);
  let markResponse = () => {};
  const unsubscribe = session.subscribe((event) => {
    if (assistantEvent(event)) markResponse();
    if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
      recordToolExecutionTiming(timings, event);
    } else if (event.type !== "message_end" && event.type !== "compaction_end") {
      return;
    }
    projection = projectSession(session, options, projection);
    options.onProgress?.({
      preview: finalOutput(session.messages),
      usage: projection.usage,
      model: projection.model,
      contextWindow: projection.contextWindow,
      transcript: transcriptFromMessages(session.messages, timings),
    });
  });
  return {
    timings,
    setMarkResponse(mark: () => void) {
      markResponse = mark;
    },
    projection() {
      projection = projectSession(session, options, projection);
      return projection;
    },
    unsubscribe,
  };
}
