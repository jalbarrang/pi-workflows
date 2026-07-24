import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TOOL_TIMEOUT_MS, TOOL_TIMEOUT_MS } from "../run/limits.ts";
import { resolveToolTimeout } from "../run/timeout-resolution.ts";

test("an omitted toolTimeoutMs inherits the upstream three-minute default", () => {
  assert.deepEqual(resolveToolTimeout({}), { timeoutMs: TOOL_TIMEOUT_MS });
  assert.equal(TOOL_TIMEOUT_MS, 180_000);
});

test("an explicit toolTimeoutMs within the cap is honored", () => {
  assert.deepEqual(resolveToolTimeout({ toolTimeoutMs: 420_000 }), { timeoutMs: 420_000 });
  assert.deepEqual(resolveToolTimeout({ toolTimeoutMs: MAX_TOOL_TIMEOUT_MS }), {
    timeoutMs: MAX_TOOL_TIMEOUT_MS,
  });
});

test("a toolTimeoutMs above the cap is rejected rather than clamped", () => {
  const resolved = resolveToolTimeout({ toolTimeoutMs: MAX_TOOL_TIMEOUT_MS + 1 });
  assert.equal(resolved.timeoutMs, undefined);
  assert.match(resolved.error ?? "", /invalid toolTimeoutMs "600001" \(use a positive integer/);
});

test("non-integer and non-positive timeouts are rejected", () => {
  for (const value of ["300000", 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null]) {
    const resolved = resolveToolTimeout({ toolTimeoutMs: value });
    assert.equal(resolved.timeoutMs, undefined, `accepted ${String(value)}`);
    assert.match(resolved.error ?? "", /invalid toolTimeoutMs/);
  }
});
