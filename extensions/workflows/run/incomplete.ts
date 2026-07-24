import { isSkippedPhase, phaseGroups } from "./groups.ts";
import type { WorkflowDetails } from "./types.ts";

/**
 * Declared phases that produced no successful agent.
 *
 * A run's headline fields all come from the script's own return value, so a phase
 * whose only agent died can still read as "reviewed, nothing found" — observed in
 * run `wf_e45f788c8902`. This list is computed from agent state instead, so the
 * absence of a result is visible without trusting the script to report it.
 *
 * An optional phase the run never entered is a deliberate skip, not a hole.
 * Unphased agents are excluded: their failure already shows in the agent list.
 */
export function incompletePhases(details: WorkflowDetails): string[] {
  const declared = new Set(details.phases.map((phase) => phase.title));
  return phaseGroups(details, true)
    .filter((group) => declared.has(group.title) && !isSkippedPhase(group))
    .filter((group) => !group.agents.some((agent) => agent.state === "done"))
    .map((group) => group.title);
}
