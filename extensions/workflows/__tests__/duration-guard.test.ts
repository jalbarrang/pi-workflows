import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgentDurationGuard } from "../agent/duration.ts";

test("the duration guard aborts an agent that exceeds its bound", async () => {
  let aborted = false;
  const guard = createAgentDurationGuard(async () => {
    aborted = true;
  }, 10);
  await assert.rejects(guard.waitFor(new Promise<never>(() => {})), /maxDurationMs of 10 ms/);
  assert.equal(aborted, true);
  assert.equal(guard.exceeded(), true);
});

test("cancel disarms a guard that was never awaited", async () => {
  let aborted = false;
  const guard = createAgentDurationGuard(async () => {
    aborted = true;
  }, 10);
  guard.cancel();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(aborted, false);
  assert.equal(guard.exceeded(), false);
});

test("an unbounded duration guard leaves the operation alone", async () => {
  const guard = createAgentDurationGuard(async () => {}, undefined);
  assert.equal(await guard.waitFor(Promise.resolve("done")), "done");
  assert.equal(guard.exceeded(), false);
});
