import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentUsage } from "../run/types.ts";
import { computeUsage, contextUsage } from "./usage.ts";
import type { RunAgentOptions } from "./types.ts";

export interface SessionProjection {
  usage: AgentUsage;
  model?: string;
  contextWindow?: number;
  stopReason?: string;
  error?: string;
}

export function projectSession(
  session: AgentSession,
  options: RunAgentOptions,
  previous?: SessionProjection,
): SessionProjection {
  const context = contextUsage(session);
  const usage = computeUsage(session.messages);
  if (context.tokens !== undefined) usage.contextTokens = context.tokens;
  let model = session.model?.id ?? previous?.model ?? options.model?.id;
  let contextWindow = context.window ?? session.model?.contextWindow ?? previous?.contextWindow;
  let stopReason = previous?.stopReason;
  let error = previous?.error;
  const message = [...session.messages].reverse().find((item) => item.role === "assistant");
  if (message?.role === "assistant") {
    const matches =
      !session.model ||
      (message.provider === session.model.provider && message.model === session.model.id);
    const reported = matches
      ? options.modelRegistry.find(message.provider, message.responseModel ?? message.model)
      : undefined;
    if (reported) {
      model = reported.id;
      contextWindow = reported.contextWindow;
    }
    stopReason = message.stopReason ?? stopReason;
    error = message.errorMessage ?? error;
  }
  return { usage, model, contextWindow, stopReason, error };
}
