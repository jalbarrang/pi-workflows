import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyAgentOutcome } from "../agent/outcome.ts";

const base = { aborted: false, schemaRequested: false, hasStructured: false };

test("a transport error after a recorded structured result is a delivery failure only", () => {
  const verdict = classifyAgentOutcome({
    ...base,
    caught: "WebSocket error",
    schemaRequested: true,
    hasStructured: true,
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.error, undefined);
  assert.equal(verdict.deliveryError, "WebSocket error");
});

test("the same transport error without a recorded result stays fatal", () => {
  const verdict = classifyAgentOutcome({
    ...base,
    caught: "WebSocket error",
    schemaRequested: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.deliveryError, undefined);
  assert.equal(verdict.error, "WebSocket error");
});

test("a reported assistant error is salvaged the same way as a thrown one", () => {
  const verdict = classifyAgentOutcome({
    ...base,
    projectionError: "stream closed",
    stopReason: "error",
    schemaRequested: true,
    hasStructured: true,
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.deliveryError, "stream closed");
});

test("an abort is never salvaged, even with a recorded result", () => {
  const verdict = classifyAgentOutcome({
    ...base,
    aborted: true,
    schemaRequested: true,
    hasStructured: true,
  });
  assert.equal(verdict.deliveryError, undefined);
  assert.deepEqual(verdict, { ok: false, aborted: true, error: "Agent was aborted" });
});

test("a schema agent that never called structured_output fails", () => {
  const verdict = classifyAgentOutcome({ ...base, schemaRequested: true });
  assert.equal(verdict.ok, false);
  assert.match(verdict.error ?? "", /without calling structured_output/);
});

test("a plain agent with no failure signals succeeds without notes", () => {
  assert.deepEqual(classifyAgentOutcome(base), { ok: true, aborted: false });
});

test("a plain agent's transport error is not salvageable: there is nothing recorded", () => {
  const verdict = classifyAgentOutcome({ ...base, caught: "WebSocket error" });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.error, "WebSocket error");
});
