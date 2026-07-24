import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWorkflowResultMessage } from "../presentation/result-text.ts";
import { incompletePhases } from "../run/incomplete.ts";
import type { AgentRecord, AgentState } from "../run/types.ts";
import { workflowDetails } from "./fixtures.ts";

function agent(label: string, phase: string, state: AgentState): AgentRecord {
  return {
    index: 1,
    label,
    phase,
    state,
    startedAt: 1,
    preview: "",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
    transcript: [],
  };
}

test("a declared phase whose only agent failed is reported incomplete", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Implement" }, { title: "Review" }];
  details.agents = [agent("impl", "Implement", "done"), agent("review", "Review", "error")];
  assert.deepEqual(incompletePhases(details), ["Review"]);
});

test("a phase with at least one successful agent is complete", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Scan" }];
  details.agents = [agent("a", "Scan", "error"), agent("b", "Scan", "done")];
  assert.deepEqual(incompletePhases(details), []);
});

test("an optional phase the run skipped is not incomplete, an empty required one is", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Fixup", optional: true }, { title: "Report" }];
  assert.deepEqual(incompletePhases(details), ["Report"]);
});

test("unphased agents are not reported as an incomplete phase", () => {
  const details = workflowDetails();
  details.agents = [{ ...agent("loose", "Review", "error"), phase: undefined }];
  assert.deepEqual(incompletePhases(details), []);
});

test("the tool result names incomplete phases and salvaged deliveries", () => {
  const details = workflowDetails();
  details.status = "completed";
  details.phases = [{ title: "Review" }];
  details.incompletePhases = ["Review"];
  details.agents = [{ ...agent("review", "Review", "done"), deliveryError: "WebSocket error" }];
  details.result = { blockingCount: 0 };
  const message = buildWorkflowResultMessage(details, "/tmp/wf");
  assert.match(message, /Incomplete phases \(no successful agent\): Review/);
  assert.match(message, /\[review\] \(Review\) ok — delivery failed: WebSocket error/);
});
