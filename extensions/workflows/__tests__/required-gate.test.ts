import assert from "node:assert/strict";
import { test } from "node:test";
import { abortForFailedGate } from "../run/agent-outcome.ts";
import { resolveAgentOptions } from "../run/agent-options.ts";
import { RunController } from "../run/controller.ts";
import { gateStatus } from "../run/required-resolution.ts";
import { WorkflowState } from "../run/state.ts";
import type { RunRuntime } from "../run/runtime.ts";
import type { AgentRecord } from "../run/types.ts";
import { workflowDetails } from "./fixtures.ts";

const context = { model: undefined, modelRegistry: { find: () => undefined, getAll: () => [] } };
const resolve = (options: Record<string, unknown>) =>
  resolveAgentOptions(options, context as never, "high");

function gateRuntime() {
  const controller = new RunController();
  const state = new WorkflowState(workflowDetails());
  const runtime = {
    controller,
    state,
    persistence: { checkpoint() {}, flush() {} },
    emit() {},
  } as unknown as RunRuntime;
  const record = { label: "review" } as AgentRecord;
  return { runtime, controller, state, record };
}

test("required accepts booleans only", () => {
  assert.equal(resolve({}).resolved?.required, false);
  assert.equal(resolve({ required: true }).resolved?.required, true);
  assert.equal(resolve({ required: false }).resolved?.required, false);
  assert.match(
    resolve({ required: "yes" }).error ?? "",
    /invalid required "yes" \(use true\|false\)/,
  );
});

test("a failed gate aborts the run and records why", () => {
  const { runtime, controller, state, record } = gateRuntime();
  abortForFailedGate(runtime, record, "WebSocket error");
  assert.equal(controller.signal.aborted, true);
  assert.equal(state.snapshot().requiredFailure, 'Required agent "review" failed: WebSocket error');
});

test("a run aborted for another reason is not relabelled as a gate failure", () => {
  const { runtime, controller, state, record } = gateRuntime();
  controller.abort("Parent operation was aborted");
  abortForFailedGate(runtime, record, "WebSocket error");
  assert.equal(state.snapshot().requiredFailure, undefined);
});

test("the first gate failure wins over later ones", () => {
  const { runtime, state, record } = gateRuntime();
  abortForFailedGate(runtime, record, "first");
  abortForFailedGate(runtime, { label: "other" } as AgentRecord, "second");
  assert.match(state.snapshot().requiredFailure ?? "", /"review" failed: first/);
});

test("a gate failure outranks both a clean completion and a bare abort", () => {
  assert.equal(gateStatus("completed", 'Required agent "review" failed: x'), "failed");
  assert.equal(gateStatus("aborted", 'Required agent "review" failed: x'), "failed");
  assert.equal(gateStatus("completed", undefined), "completed");
  assert.equal(gateStatus("aborted", undefined), "aborted");
});
