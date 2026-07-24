import { renderDetail } from "./render-detail.ts";
import { renderRunList } from "./render-list.ts";
import { renderTranscript } from "./render-transcript.ts";
import { selectedAgent, type DashboardState } from "./state.ts";

export function renderDashboard(state: DashboardState, width: number) {
  const height = Math.max(10, state.tui.terminal.rows - 1);
  if (state.view === "transcript" && state.current && selectedAgent(state)) {
    return renderTranscript(state, width, height);
  }
  if (state.current && state.view !== "list") return renderDetail(state, width, height);
  return renderRunList(state, width, height);
}
