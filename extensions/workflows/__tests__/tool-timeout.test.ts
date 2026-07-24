import assert from "node:assert/strict";
import { test } from "node:test";
import { runWithToolCallTimeout, ToolCallTimeoutError } from "../agent/index.ts";
import { TOOL_TIMEOUT_MS } from "../run/limits.ts";

test("the production timeout error names the tool and three-minute limit", () => {
  assert.equal(
    new ToolCallTimeoutError("fixture_tool", TOOL_TIMEOUT_MS).message,
    'Tool call "fixture_tool" timed out after 3 minutes.',
  );
});

test("a hung tool call fails clearly and receives an abort signal", async () => {
  let executionSignal: AbortSignal | undefined;
  await assert.rejects(
    runWithToolCallTimeout("hung_fixture", 10, undefined, (signal) => {
      executionSignal = signal;
      return new Promise(() => {});
    }),
    (error: unknown) => error instanceof ToolCallTimeoutError,
  );
  assert.equal(executionSignal?.aborted, true);
  assert.equal(executionSignal?.reason instanceof ToolCallTimeoutError, true);
});

test("parent cancellation stops the timeout wrapper immediately", async () => {
  const controller = new AbortController();
  const reason = new Error("cancelled fixture");
  const pending = runWithToolCallTimeout(
    "hung_fixture",
    60_000,
    controller.signal,
    () => new Promise(() => {}),
  );
  controller.abort(reason);
  await assert.rejects(pending, (error: unknown) => error === reason);
});

test("the timeout is fresh for each tool call", async () => {
  const execute = () =>
    runWithToolCallTimeout("slow_fixture", 100, undefined, async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return "done";
    });
  assert.equal(await execute(), "done");
  assert.equal(await execute(), "done");
});
