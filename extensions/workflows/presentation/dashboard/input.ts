import { Key, matchesKey } from "@earendil-works/pi-tui";
import { phaseGroups } from "../../run/groups.ts";
import { saveReport } from "./report.ts";
import { selectedAgent, selectedGroup, type DashboardState, wrapSelection } from "./state.ts";

export function handleDashboardInput(state: DashboardState, data: string) {
  const up = state.keys.matches(data, "tui.select.up") || data === "k";
  const down = state.keys.matches(data, "tui.select.down") || data === "j";
  const left = state.keys.matches(data, "tui.editor.cursorLeft") || data === "h";
  const right = state.keys.matches(data, "tui.editor.cursorRight") || data === "l";
  const confirm = state.keys.matches(data, "tui.select.confirm");
  const cancel = state.keys.matches(data, "tui.select.cancel");
  if (state.view === "list") {
    if (up) state.listIndex = wrapSelection(state.listIndex, -1, state.entries.length);
    else if (down) state.listIndex = wrapSelection(state.listIndex, 1, state.entries.length);
    else if (data === "g") state.listIndex = 0;
    else if (data === "G") state.listIndex = Math.max(0, state.entries.length - 1);
    else if (confirm && state.entries[state.listIndex]) {
      state.current = state.entries[state.listIndex];
      state.phaseIndex = 0;
      state.agentIndex = 0;
      state.focus = "phases";
      state.view = "detail";
    } else if (cancel) return state.close();
  } else if (state.view === "detail") {
    const groups = state.current ? phaseGroups(state.current.details, true) : [];
    if (state.focus === "phases") {
      if (up) state.phaseIndex = wrapSelection(state.phaseIndex, -1, groups.length);
      else if (down) state.phaseIndex = wrapSelection(state.phaseIndex, 1, groups.length);
      else if (data === "g") state.phaseIndex = 0;
      else if (data === "G") state.phaseIndex = Math.max(0, groups.length - 1);
      else if (right || confirm) {
        if (selectedGroup(state)?.agents.length) state.focus = "agents";
      } else if (cancel) state.view = "list";
      state.agentIndex = Math.min(
        state.agentIndex,
        Math.max(0, (selectedGroup(state)?.agents.length ?? 1) - 1),
      );
    } else {
      const agents = selectedGroup(state)?.agents ?? [];
      if (up) state.agentIndex = wrapSelection(state.agentIndex, -1, agents.length);
      else if (down) state.agentIndex = wrapSelection(state.agentIndex, 1, agents.length);
      else if (data === "g") state.agentIndex = 0;
      else if (data === "G") state.agentIndex = Math.max(0, agents.length - 1);
      else if (left || cancel) state.focus = "phases";
      else if (confirm && selectedAgent(state)) {
        state.scroll = 0;
        state.view = "transcript";
      }
    }
    if (data === "s" && state.current) {
      try {
        state.notice = saveReport(state.current.details);
      } catch (error) {
        state.notice = `save failed: ${String(error)}`;
      }
      state.noticeAt = Date.now();
    }
  } else {
    const maximum = Math.max(0, state.transcriptRows - state.viewport);
    const page = Math.max(1, state.viewport - 2);
    if (up) state.scroll = Math.max(0, state.scroll - (data === "k" ? 20 : 1));
    else if (down) state.scroll = Math.min(maximum, state.scroll + (data === "j" ? 20 : 1));
    else if (matchesKey(data, Key.ctrl("u"))) state.scroll = Math.max(0, state.scroll - page);
    else if (matchesKey(data, Key.ctrl("d"))) state.scroll = Math.min(maximum, state.scroll + page);
    else if (data === "g") state.scroll = 0;
    else if (data === "G") state.scroll = maximum;
    else if (cancel || left) state.view = "detail";
  }
  state.tui.requestRender();
}
