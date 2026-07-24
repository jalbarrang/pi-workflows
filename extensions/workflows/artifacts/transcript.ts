import type { TranscriptEntry } from "../run/types.ts";
import { TRANSCRIPT_ENTRY_MAX_BYTES, TRANSCRIPT_MAX_BYTES } from "./limits.ts";
import { truncateUtf8 } from "./utf8.ts";

const ENTRY_MARKER = "\n[entry truncated]";
const TRANSCRIPT_MARKER = "[artifact transcript truncated: older entries omitted]";
const bytes = (text: string) => Buffer.byteLength(text);
function boundEntry(entry: TranscriptEntry, maxBytes: number) {
  if (bytes(entry.text) <= maxBytes) return { ...entry };
  const contentBytes = Math.max(0, maxBytes - bytes(ENTRY_MARKER));
  return { ...entry, text: `${truncateUtf8(entry.text, contentBytes)}${ENTRY_MARKER}` };
}

export function boundedArtifactTranscript(
  transcript: TranscriptEntry[],
  options: { maxBytes?: number; entryMaxBytes?: number } = {},
) {
  if (!transcript.length) return [];
  const maxBytes = Math.max(256, options.maxBytes ?? TRANSCRIPT_MAX_BYTES);
  const entryMax = Math.max(
    64,
    Math.min(maxBytes, options.entryMaxBytes ?? TRANSCRIPT_ENTRY_MAX_BYTES),
  );
  const bounded = transcript.map((entry) => boundEntry(entry, entryMax));
  if (bounded.reduce((total, entry) => total + bytes(entry.text), 0) <= maxBytes) return bounded;
  const initialIndex = transcript.findIndex((entry) => entry.role === "user");
  const firstIndex = initialIndex < 0 ? 0 : initialIndex;
  const marker: TranscriptEntry = {
    role: "toolResult",
    name: "transcript",
    text: TRANSCRIPT_MARKER,
  };
  const first = boundEntry(
    transcript[firstIndex],
    Math.min(entryMax, maxBytes - bytes(marker.text)),
  );
  let remaining = maxBytes - bytes(first.text) - bytes(marker.text);
  const tail: TranscriptEntry[] = [];
  for (let index = transcript.length - 1; index >= 0 && remaining > 0; index--) {
    if (index === firstIndex) continue;
    const entry = boundEntry(transcript[index], Math.min(entryMax, remaining));
    tail.push(entry);
    remaining -= bytes(entry.text);
  }
  return [first, marker, ...tail.reverse()];
}
