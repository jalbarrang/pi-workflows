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
 * An optional phase the run never entered is a deliberate skip, not a hole. So is
 * a phase served only by `optional: true` agents: the author declared that their
 * failure is tolerable, and reporting it here would train a reader to ignore the
 * one field whose whole job is to be alarming.
 * Unphased agents are excluded: their failure already shows in the agent list.
 */
/** True once a phase ran and every agent that served it was declared optional. */
function bestEffortOnly(group: { agents: { optional?: boolean }[] }) {
  return group.agents.length > 0 && group.agents.every((agent) => agent.optional === true);
}

export function incompletePhases(details: WorkflowDetails): string[] {
  const declared = new Set(details.phases.map((phase) => phase.title));
  return phaseGroups(details, true)
    .filter((group) => declared.has(group.title) && !isSkippedPhase(group))
    .filter((group) => !group.agents.some((agent) => agent.state === "done"))
    .filter((group) => bestEffortOnly(group) === false)
    .map((group) => group.title);
}
