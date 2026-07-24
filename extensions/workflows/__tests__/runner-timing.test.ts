import assert from "node:assert/strict";
import { test } from "node:test";
import {
  recordToolExecutionTiming,
  transcriptFromMessages,
  type ToolExecutionTiming,
} from "../agent/index.ts";
import { parallelToolMessages } from "./runner-fixture.ts";

test("completed parallel tool calls pair lifecycle timings with calls and results", () => {
  const timings = new Map<string, ToolExecutionTiming>();
  recordToolExecutionTiming(
    timings,
    { type: "tool_execution_start", toolCallId: "call-a", toolName: "first", args: { value: 1 } },
    1_000,
  );
  recordToolExecutionTiming(
    timings,
    { type: "tool_execution_start", toolCallId: "call-b", toolName: "second", args: { value: 2 } },
    1_002,
  );
  recordToolExecutionTiming(
    timings,
    {
      type: "tool_execution_end",
      toolCallId: "call-b",
      toolName: "second",
      result: { content: [{ type: "text", text: "second result" }] },
      isError: false,
    },
    1_012,
  );
  recordToolExecutionTiming(
    timings,
    {
      type: "tool_execution_end",
      toolCallId: "call-a",
      toolName: "first",
      result: { content: [{ type: "text", text: "first result" }] },
      isError: false,
    },
    1_030,
  );
  const transcript = transcriptFromMessages(parallelToolMessages(), timings);
  const expected = [
    { toolCallId: "call-a", startedAt: 1_000, finishedAt: 1_030, durationMs: 30 },
    { toolCallId: "call-b", startedAt: 1_002, finishedAt: 1_012, durationMs: 10 },
  ];
  for (const role of ["tool", "toolResult"]) {
    assert.deepEqual(
      transcript
        .filter((entry) => entry.role === role)
        .map(({ toolCallId, startedAt, finishedAt, durationMs }) => ({
          toolCallId,
          startedAt,
          finishedAt,
          durationMs,
        })),
      expected,
    );
  }
});
test("in-flight aborted tool calls retain start timing without completion", () => {
  const timings = new Map<string, ToolExecutionTiming>();
  recordToolExecutionTiming(
    timings,
    { type: "tool_execution_start", toolCallId: "call-a", toolName: "first", args: {} },
    2_000,
  );
  const transcript = transcriptFromMessages(parallelToolMessages().slice(0, 2), timings);
  const first = transcript.find((entry) => entry.toolCallId === "call-a");
  assert.equal(first?.startedAt, 2_000);
  assert.equal(first?.finishedAt, undefined);
  assert.equal(first?.durationMs, undefined);
  assert.equal(
    transcript.some((entry) => entry.role === "toolResult"),
    false,
  );
});
