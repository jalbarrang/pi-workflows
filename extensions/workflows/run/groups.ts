import type { AgentRecord, WorkflowDetails } from "./types.ts";

export interface PhaseGroup {
  title: string;
  agents: AgentRecord[];
  optional?: boolean;
}

/** A phase the author declared as conditional that the run never entered. */
export function isSkippedPhase(group: PhaseGroup) {
  return group.optional === true && group.agents.length === 0;
}

export function phaseGroups(details: WorkflowDetails, includeEmpty = false): PhaseGroup[] {
  const pending = new Map<string, AgentRecord[]>();
  for (const agent of details.agents) {
    const title = agent.phase ?? "(unphased)";
    pending.set(title, [...(pending.get(title) ?? []), agent]);
  }
  const groups: PhaseGroup[] = [];
  for (const phase of details.phases) {
    const agents = pending.get(phase.title);
    if (agents || includeEmpty) {
      groups.push({
        title: phase.title,
        agents: agents ?? [],
        ...(phase.optional === true ? { optional: true } : {}),
      });
    }
    pending.delete(phase.title);
  }
  for (const [title, agents] of pending) groups.push({ title, agents });
  return groups;
}
