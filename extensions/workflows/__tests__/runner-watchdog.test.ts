import assert from "node:assert/strict";
import { test } from "node:test";
import { createFirstResponseWatchdog } from "../agent/index.ts";

test("first-response watchdog aborts a silent provider request", async () => {
  let aborted = false;
  const watchdog = createFirstResponseWatchdog(
    async () => {
      aborted = true;
    },
    { timeoutMs: 10, model: "fixture-model" },
  );
  await assert.rejects(
    watchdog.waitFor(new Promise<never>(() => {})),
    /no assistant response event for fixture-model within 10 ms.*stalled/i,
  );
  assert.equal(aborted, true);
});
test("first assistant response disarms the watchdog without limiting the run", async () => {
  const watchdog = createFirstResponseWatchdog(
    async () => {
      throw new Error("watchdog should have been disarmed");
    },
    { timeoutMs: 10 },
  );
  watchdog.markResponse();
  const result = await watchdog.waitFor(
    new Promise<string>((resolve) => setTimeout(() => resolve("done"), 20)),
  );
  assert.equal(result, "done");
});
