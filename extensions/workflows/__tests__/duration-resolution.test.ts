import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAgentDuration } from "../run/duration-resolution.ts";
import { MAX_AGENT_DURATION_MS } from "../run/limits.ts";

test("an omitted maxDurationMs leaves the agent unbounded", () => {
  assert.deepEqual(resolveAgentDuration({}), {});
});

test("an explicit maxDurationMs within the cap is honored", () => {
  assert.deepEqual(resolveAgentDuration({ maxDurationMs: 900_000 }), { durationMs: 900_000 });
  assert.deepEqual(resolveAgentDuration({ maxDurationMs: MAX_AGENT_DURATION_MS }), {
    durationMs: MAX_AGENT_DURATION_MS,
  });
});

test("invalid maxDurationMs values are rejected rather than clamped", () => {
  for (const value of [0, -1, 1.5, "900000", MAX_AGENT_DURATION_MS + 1]) {
    const resolved = resolveAgentDuration({ maxDurationMs: value });
    assert.equal(resolved.durationMs, undefined, `accepted ${String(value)}`);
    assert.match(resolved.error ?? "", /invalid maxDurationMs/);
  }
});
