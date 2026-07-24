import { phaseGroups } from "../../run/groups.ts";
import type { WorkflowDetails } from "../../run/types.ts";
import { loadRunEntries } from "./load.ts";
import type { DashboardState } from "./state.ts";

const NOTICE_TTL_MS = 4_000;

export function refreshDashboard(
  state: DashboardState,
  active: ReadonlyMap<string, WorkflowDetails>,
  sessionId: string,
  referenced: ReadonlySet<string>,
) {
  let changed = false;
  if (state.noticeAt && Date.now() - state.noticeAt > NOTICE_TTL_MS) {
    state.notice = undefined;
    state.noticeAt = undefined;
    changed = true;
  }
  if (!state.entries.some((entry) => entry.live)) return changed;
  const selectedId = state.entries[state.listIndex]?.runId;
  const currentId = state.current?.runId;
  state.entries = loadRunEntries(active, sessionId, referenced);
  const selected = state.entries.findIndex((entry) => entry.runId === selectedId);
  state.listIndex =
    selected >= 0 ? selected : Math.max(0, Math.min(state.listIndex, state.entries.length - 1));
  if (currentId) {
    state.current = state.entries.find((entry) => entry.runId === currentId);
    if (!state.current) state.view = "list";
  }
  const groups = state.current ? phaseGroups(state.current.details, true) : [];
  state.phaseIndex = Math.max(0, Math.min(state.phaseIndex, groups.length - 1));
  const agents = groups[state.phaseIndex]?.agents ?? [];
  state.agentIndex = Math.max(0, Math.min(state.agentIndex, agents.length - 1));
  return true;
}
