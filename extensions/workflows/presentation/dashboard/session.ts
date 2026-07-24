import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function sessionWorkflowRunIds(ctx: ExtensionContext) {
  const ids = new Set<string>();
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "toolResult") continue;
    if (entry.message.toolName !== "workflow") continue;
    const details = entry.message.details;
    if (!details || typeof details !== "object") continue;
    const runId = (details as Record<string, unknown>).runId;
    if (typeof runId === "string") ids.add(runId);
  }
  return ids;
}
