import { truncateHead } from "@earendil-works/pi-coding-agent";
import { safeStringify } from "../artifacts/index.ts";

export function resultJson(value: unknown) {
  const text =
    typeof value === "string"
      ? value
      : safeStringify(value, { maxBytes: 48 * 1024, maxDepth: 16, maxNodes: 10_000 });
  const result = truncateHead(text, { maxLines: 600, maxBytes: 24 * 1024 });
  return result.truncated
    ? `${result.content}\n…[result truncated; bounded result artifact in result.json]`
    : result.content;
}
