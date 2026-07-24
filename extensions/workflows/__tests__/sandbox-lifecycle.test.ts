import assert from "node:assert/strict";
import { test } from "node:test";
import { runSandbox } from "./sandbox-fixture.ts";

test("sandbox VM still rejects non-yielding synchronous code", async () => {
  await assert.rejects(runSandbox(`while (true) {}`), /timed out/);
});
test("workflow agent invocations have no per-request wall timer", async () => {
  let signalAborted = false;
  const result = await runSandbox(`return (await agent("delayed")).output;`, {
    onAgent: async (_prompt, _options, signal) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      signalAborted = signal.aborted;
      return { ok: true, output: "completed" };
    },
  });
  assert.equal(result, "completed");
  assert.equal(signalAborted, false);
});
test("workflow cancellation aborts a pending agent request", async () => {
  const controller = new AbortController();
  let startedResolve: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    startedResolve = resolve;
  });
  let requestAborted = false;
  const pending = runSandbox(`return await agent("pending");`, {
    signal: controller.signal,
    onAgent: async (_prompt, _options, signal) => {
      startedResolve?.();
      await new Promise<void>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            requestAborted = true;
            resolve();
          },
          { once: true },
        );
      });
      return { ok: false, output: "", error: "Agent was aborted" };
    },
  });
  await started;
  controller.abort(new Error("cancel fixture"));
  await assert.rejects(pending, /Workflow was aborted/);
  assert.equal(requestAborted, true);
});
