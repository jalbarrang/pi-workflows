import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { WorkflowDetails } from "../../run/types.ts";
import { handleDashboardInput } from "./input.ts";
import { loadRunEntries } from "./load.ts";
import { refreshDashboard } from "./refresh.ts";
import { renderDashboard } from "./render.ts";
import { sessionWorkflowRunIds } from "./session.ts";
import type { DashboardState } from "./state.ts";

export async function showWorkflowDashboard(
  ctx: ExtensionContext,
  getActive: () => ReadonlyMap<string, WorkflowDetails>,
  initialRunId?: string,
) {
  const sessionId = ctx.sessionManager.getSessionId();
  const referenced = sessionWorkflowRunIds(ctx);
  await ctx.ui.custom<void>((tui, theme, keys, done) => {
    const state: DashboardState = {
      tui,
      theme,
      keys,
      entries: loadRunEntries(getActive(), sessionId, referenced),
      view: "list",
      listIndex: 0,
      phaseIndex: 0,
      agentIndex: 0,
      focus: "phases",
      scroll: 0,
      transcriptRows: 0,
      viewport: 1,
      close: () => done(undefined),
    };
    if (initialRunId) {
      const entry = state.entries.find(
        (candidate) => candidate.runId === initialRunId || candidate.runId.endsWith(initialRunId),
      );
      if (entry) {
        state.current = entry;
        state.listIndex = state.entries.indexOf(entry);
        state.view = "detail";
      }
    }
    const refresh = setInterval(() => {
      if (refreshDashboard(state, getActive(), sessionId, referenced)) tui.requestRender();
    }, 500);
    refresh.unref?.();
    return {
      render: (width: number) => renderDashboard(state, width),
      handleInput: (data: string) => handleDashboardInput(state, data),
      invalidate() {},
      dispose() {
        clearInterval(refresh);
      },
    };
  });
}
