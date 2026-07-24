import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { emptyUsage } from "../run/usage.ts";
import type { AgentMessage } from "./types.ts";

export function finalOutput(messages: AgentMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const output = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (output) return output;
  }
  return "";
}

export function computeUsage(messages: AgentMessage[]) {
  const usage = emptyUsage();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    usage.turns++;
    usage.input += message.usage?.input || 0;
    usage.output += message.usage?.output || 0;
    usage.cacheRead += message.usage?.cacheRead || 0;
    usage.cacheWrite += message.usage?.cacheWrite || 0;
    usage.cost += message.usage?.cost?.total || 0;
  }
  return usage;
}

export function contextUsage(session: AgentSession) {
  const context = session.getContextUsage();
  return {
    tokens:
      typeof context?.tokens === "number" && Number.isFinite(context.tokens) && context.tokens >= 0
        ? context.tokens
        : undefined,
    window:
      typeof context?.contextWindow === "number" &&
      Number.isFinite(context.contextWindow) &&
      context.contextWindow > 0
        ? context.contextWindow
        : undefined,
  };
}
