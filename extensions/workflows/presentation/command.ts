import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ActiveRun, WorkflowDetails } from "../run/types.ts";
import { buildWorkflowResultMessage } from "./result-text.ts";
import { loadRunEntries, runsDir } from "./dashboard/load.ts";
import { sessionWorkflowRunIds } from "./dashboard/session.ts";
import { showWorkflowDashboard } from "./dashboard/show.ts";

function activeDetails(active: ReadonlyMap<string, ActiveRun>) {
  return new Map([...active].map(([runId, run]) => [runId, run.details] as const));
}
function plainDetail(details: WorkflowDetails) {
  return buildWorkflowResultMessage(details, path.join(runsDir(), details.runId));
}
export function registerWorkflowCommand(
  pi: ExtensionAPI,
  active: ReadonlyMap<string, ActiveRun>,
  acknowledge: () => void,
) {
  pi.registerCommand("workflows", {
    description: "Inspect this session's workflow runs and transcripts",
    handler: async (raw, ctx) => {
      const query = raw.trim();
      const current = () => activeDetails(active);
      if (ctx.mode === "tui") {
        acknowledge();
        await showWorkflowDashboard(ctx, current, query || undefined);
        return;
      }
      const entries = loadRunEntries(
        current(),
        ctx.sessionManager.getSessionId(),
        sessionWorkflowRunIds(ctx as ExtensionContext),
      );
      if (!entries.length) return ctx.ui.notify("No workflow runs yet.", "info");
      if (query) {
        const found = entries.find((entry) => entry.runId === query || entry.runId.endsWith(query));
        return ctx.ui.notify(
          found ? plainDetail(found.details) : `No run matching "${query}".`,
          found ? "info" : "warning",
        );
      }
      const labels = entries.map((entry) => {
        const settled = entry.details.agents.filter((agent) => agent.state !== "running").length;
        return (
          `${entry.live ? "*" : " "} ${entry.runId} ${entry.details.status} ` +
          `${entry.details.name ?? ""} ${settled}/${entry.details.agents.length}`
        );
      });
      if (!ctx.hasUI) return ctx.ui.notify(labels.join("\n"), "info");
      const choice = await ctx.ui.select("Workflow runs", labels);
      const selected = choice ? entries[labels.indexOf(choice)] : undefined;
      if (selected) ctx.ui.notify(plainDetail(selected.details), "info");
    },
  });
}
