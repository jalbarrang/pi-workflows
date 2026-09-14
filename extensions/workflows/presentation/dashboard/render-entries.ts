import { getMarkdownTheme, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Markdown, Text } from "@earendil-works/pi-tui";
import type { TranscriptEntry } from "../../run/types.ts";

type Theme = ExtensionContext["ui"]["theme"];

/** ` · 120ms` when the entry recorded timing, empty otherwise. */
function timing(entry: TranscriptEntry) {
  return entry.durationMs === undefined ? "" : ` · ${entry.durationMs}ms`;
}

function body(entry: TranscriptEntry) {
  return entry.text.trim() || "(empty)";
}

/** The chat's user card: padded, `userMessageBg` background, markdown body. */
function userRows(entry: TranscriptEntry, width: number, theme: Theme) {
  const box = new Box(1, 1, (line) => theme.bg("userMessageBg", line));
  box.addChild(
    new Markdown(body(entry), 0, 0, getMarkdownTheme(), {
      color: (text) => theme.fg("userMessageText", text),
    }),
  );
  return box.render(width);
}

/** Assistant prose renders exactly as the chat does it: bare markdown, one column of padding. */
function assistantRows(entry: TranscriptEntry, width: number) {
  return new Markdown(body(entry), 1, 0, getMarkdownTheme()).render(width);
}

function thinkingRows(entry: TranscriptEntry, width: number, theme: Theme) {
  const markdown = new Markdown(body(entry), 1, 0, getMarkdownTheme(), {
    color: (text) => theme.fg("thinkingText", text),
    italic: true,
  });
  return [theme.fg("dim", `thinking${timing(entry)}`), ...markdown.render(width)];
}

/** Tool calls and results share the chat's tool card, colored by call, success, or failure. */
function toolRows(entry: TranscriptEntry, width: number, theme: Theme) {
  const isResult = entry.role === "toolResult";
  const background = isResult ? (entry.isError ? "toolErrorBg" : "toolSuccessBg") : "toolPendingBg";
  const box = new Box(1, 0, (line) => theme.bg(background, line));
  const title = `${isResult ? "result" : "tool"} ${entry.name ?? ""}`.trim();
  box.addChild(
    new Text(theme.fg("toolTitle", theme.bold(title)) + theme.fg("dim", timing(entry)), 0, 0),
  );
  const text = entry.text.trim();
  if (text) box.addChild(new Text(theme.fg(entry.isError ? "error" : "toolOutput", text), 0, 0));
  return box.render(width);
}

function entryRows(entry: TranscriptEntry, width: number, theme: Theme) {
  if (entry.role === "user") return userRows(entry, width, theme);
  if (entry.role === "assistant") return assistantRows(entry, width);
  if (entry.role === "thinking") return thinkingRows(entry, width, theme);
  return toolRows(entry, width, theme);
}

/**
 * Rows for one transcript, cached per array and width. Markdown parsing dominates the cost and
 * the dashboard re-renders on every keystroke; a refresh that reloads a live run builds a new
 * array and so misses the cache on purpose.
 */
const cache = new WeakMap<TranscriptEntry[], { width: number; theme: Theme; rows: string[] }>();

export function transcriptRows(entries: TranscriptEntry[], width: number, theme: Theme) {
  const cached = cache.get(entries);
  if (cached && cached.width === width && cached.theme === theme) return cached.rows;
  const rows = entries.flatMap((entry) => [...entryRows(entry, width, theme), ""]);
  cache.set(entries, { width, theme, rows });
  return rows;
}
