import { safeStringify, truncateUtf8 } from "../artifacts/index.ts";
import type { TranscriptEntry } from "../run/types.ts";
import { toolMetadata } from "./timing.ts";
import type { AgentMessage, ToolExecutionTiming } from "./types.ts";

const ENTRY_BYTES = 16 * 1024;
const TOTAL_BYTES = 256 * 1024;
const MAX_ENTRIES = 200;
const safeJson = (value: unknown) =>
  safeStringify(value, { maxBytes: ENTRY_BYTES, maxNodes: 2_000 });
function messageEntries(message: AgentMessage, timings: ReadonlyMap<string, ToolExecutionTiming>) {
  const entries: TranscriptEntry[] = [];
  if (message.role === "user") {
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) => (part.type === "text" ? part.text : `[image: ${part.mimeType}]`))
            .join("\n");
    if (text.trim()) entries.push({ role: "user", text, timestamp: message.timestamp });
  } else if (message.role === "assistant") {
    for (const part of message.content) {
      if (part.type === "text" && part.text.trim()) {
        entries.push({ role: "assistant", text: part.text, timestamp: message.timestamp });
      } else if (part.type === "thinking" && part.thinking.trim()) {
        entries.push({ role: "thinking", text: part.thinking, timestamp: message.timestamp });
      } else if (part.type === "toolCall") {
        entries.push({
          role: "tool",
          name: part.name,
          text: safeJson(part.arguments),
          timestamp: message.timestamp,
          ...toolMetadata(part.id, timings),
        });
      }
    }
  } else if (message.role === "toolResult") {
    const text = message.content
      .map((part) => (part.type === "text" ? part.text : `[image: ${part.mimeType}]`))
      .join("\n");
    entries.push({
      role: "toolResult",
      name: message.toolName,
      text,
      isError: message.isError,
      timestamp: message.timestamp,
      ...toolMetadata(message.toolCallId, timings),
    });
  }
  return entries;
}

export function transcriptFromMessages(
  messages: AgentMessage[],
  timings: ReadonlyMap<string, ToolExecutionTiming> = new Map(),
) {
  const all = messages.flatMap((message) => messageEntries(message, timings));
  const selected = all.length <= MAX_ENTRIES ? all : [all[0], ...all.slice(-(MAX_ENTRIES - 1))];
  const bounded: TranscriptEntry[] = [];
  let total = 0;
  for (const entry of selected) {
    const remaining = TOTAL_BYTES - total;
    if (remaining <= 0) break;
    const text = truncateUtf8(entry.text, Math.min(ENTRY_BYTES, remaining));
    total += Buffer.byteLength(text);
    bounded.push({
      ...entry,
      text: text === entry.text ? text : `${text}\n[transcript entry truncated]`,
    });
  }
  if (bounded.length < all.length) {
    bounded.push({
      role: "toolResult",
      name: "transcript",
      text: `[transcript truncated: retained ${bounded.length} of ${all.length} entries]`,
    });
  }
  return bounded;
}
