import type { AgentUsage, WorkflowDetails } from "./types.ts";
import { aggregateUsage, countStates } from "./usage.ts";

export function formatElapsed(startedAt: number, finishedAt?: number) {
  const seconds = Math.max(0, Math.round(((finishedAt ?? Date.now()) - startedAt) / 1_000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

export function formatTokens(count: number) {
  if (count < 1_000) return String(count);
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatUsage(usage: AgentUsage, model?: string) {
  const values: string[] = [];
  if (usage.turns) values.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
  if (usage.input) values.push(`${formatTokens(usage.input)} in`);
  if (usage.output) values.push(`${formatTokens(usage.output)} out`);
  if (usage.cost) values.push(`$${usage.cost.toFixed(4)}`);
  if (model) values.push(model);
  return values.join(" · ");
}

export function summary(details: WorkflowDetails) {
  const states = countStates(details);
  const settled = states.done + states.failed;
  const phase = details.currentPhase ? ` · ${details.currentPhase}` : "";
  return `workflow ${details.name ?? details.runId}: ${settled}/${details.agents.length} agents${phase}`;
}

export function totalUsage(details: WorkflowDetails) {
  return formatUsage(aggregateUsage(details.agents));
}
