import type { AgentRecord, AgentUsage, WorkflowDetails } from "./types.ts";

export function emptyUsage(): AgentUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
}

export function aggregateUsage(agents: AgentRecord[]): AgentUsage {
  const total = emptyUsage();
  for (const agent of agents) {
    total.input += agent.usage.input;
    total.output += agent.usage.output;
    total.cacheRead += agent.usage.cacheRead;
    total.cacheWrite += agent.usage.cacheWrite;
    total.cost += agent.usage.cost;
    total.turns += agent.usage.turns;
  }
  return total;
}

export function countStates(details: WorkflowDetails) {
  let done = 0;
  let failed = 0;
  let running = 0;
  for (const agent of details.agents) {
    if (agent.state === "done") done++;
    else if (agent.state === "error") failed++;
    else running++;
  }
  return { done, failed, running };
}
