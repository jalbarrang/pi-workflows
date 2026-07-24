import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { persistWorkflowJson } from "../artifacts/index.ts";
import { emptyUsage } from "../run/usage.ts";
import type { TranscriptEntry, WorkflowDetails } from "../run/types.ts";
import { workflowDetails } from "./fixtures.ts";

test("live artifact persistence includes current agents and transcripts", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-workflow-artifacts-"));
  try {
    const details = workflowDetails();
    details.agents.push({
      index: 1,
      label: "running-fixture",
      state: "running",
      startedAt: 2,
      preview: "working",
      usage: emptyUsage(),
      transcript: [
        { role: "user", text: "current prompt" },
        {
          role: "tool",
          name: "fixture",
          toolCallId: "call-fixture",
          text: "{}",
          startedAt: 10,
          finishedAt: 25,
          durationMs: 15,
        },
      ],
    });
    persistWorkflowJson(directory, details);
    const workflow = JSON.parse(
      readFileSync(join(directory, "workflow.json"), "utf8"),
    ) as WorkflowDetails;
    const transcripts = JSON.parse(
      readFileSync(join(directory, "transcripts.json"), "utf8"),
    ) as Record<string, TranscriptEntry[]>;
    assert.equal(workflow.agents[0]?.label, "running-fixture");
    assert.equal(transcripts["1"]?.[0]?.text, "current prompt");
    assert.deepEqual(
      {
        toolCallId: transcripts["1"]?.[1]?.toolCallId,
        startedAt: transcripts["1"]?.[1]?.startedAt,
        finishedAt: transcripts["1"]?.[1]?.finishedAt,
        durationMs: transcripts["1"]?.[1]?.durationMs,
      },
      { toolCallId: "call-fixture", startedAt: 10, finishedAt: 25, durationMs: 15 },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
