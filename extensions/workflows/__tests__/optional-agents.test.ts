import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport } from "../presentation/dashboard/report.ts";
import { buildWorkflowResultMessage } from "../presentation/result-text.ts";
import { resolveAgentOptions } from "../run/agent-options.ts";
import { compact } from "../shared/compact.ts";
import { incompletePhases } from "../run/incomplete.ts";
import type { AgentRecord, AgentState } from "../run/types.ts";
import { workflowDetails } from "./fixtures.ts";

const context = { model: undefined, modelRegistry: { find: () => undefined, getAll: () => [] } };
const resolve = (options: Record<string, unknown>) =>
  resolveAgentOptions(options, context as never, "high");

function agent(label: string, phase: string, state: AgentState, optional?: boolean): AgentRecord {
  return compact({
    index: 1,
    label,
    phase,
    state,
    startedAt: 1,
    preview: "",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
    transcript: [],
    optional,
  });
}

test("optional accepts booleans only", () => {
  assert.equal(resolve({}).resolved?.optional, false);
  assert.equal(resolve({ optional: true }).resolved?.optional, true);
  assert.equal(resolve({ optional: false }).resolved?.optional, false);
  assert.match(
    resolve({ optional: "yes" }).error ?? "",
    /invalid optional "yes" \(use true\|false\)/,
  );
});

test("a call cannot be both a gate and best-effort", () => {
  const { resolved, error } = resolve({ required: true, optional: true });
  assert.equal(resolved, undefined);
  assert.match(error ?? "", /optional and required cannot both be true/);
});

test("required with optional false stays a gate", () => {
  const { resolved } = resolve({ required: true, optional: false });
  assert.equal(resolved?.required, true);
  assert.equal(resolved?.optional, false);
});

test("a phase served only by failed optional agents is not incomplete", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Docs" }];
  details.agents = [agent("docs", "Docs", "error", true)];
  assert.deepEqual(incompletePhases(details), []);
});

test("one non-optional failure still makes the phase incomplete", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Review" }];
  details.agents = [agent("second", "Review", "error", true), agent("main", "Review", "error")];
  assert.deepEqual(incompletePhases(details), ["Review"]);
});

test("a declared phase that never ran is incomplete regardless of optional agents", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Review" }];
  details.agents = [agent("docs", "Docs", "error", true)];
  assert.deepEqual(incompletePhases(details), ["Review"]);
});

test("a failed optional agent is not rendered as a hard failure", () => {
  const details = workflowDetails();
  details.status = "completed";
  details.phases = [{ title: "Docs" }];
  details.agents = [agent("docs", "Docs", "error", true), agent("impl", "Docs", "error")];
  const message = buildWorkflowResultMessage(details, "/tmp/wf");
  assert.match(message, /\[docs\] \(Docs\) failed \(optional\)/);
  assert.match(message, /\[impl\] \(Docs\) FAILED/);
  const report = buildReport(details);
  assert.match(report, /\*\*docs\*\* — failed \(optional\)/);
  assert.match(report, /\*\*impl\*\* — FAILED/);
});
