import assert from "node:assert/strict";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { buildReport } from "../presentation/dashboard/report.ts";
import { buildWorkflowResultMessage } from "../presentation/result-text.ts";
import { workflowDetails } from "./fixtures.ts";

function detailsWithFailedArtifact() {
  const details = workflowDetails();
  details.status = "failed";
  details.phases = [{ title: "Recon" }];
  details.agents = [
    {
      index: 1,
      label: "sync",
      phase: "Recon",
      state: "error",
      startedAt: 1,
      finishedAt: 2,
      error: "Agent exceeded maxDurationMs of 900000 ms",
      preview: "",
      outputFile: path.join(os.homedir(), ".pi/agent/workflows/wf/agents/1-sync/output.md"),
      structuredFile: path.join(
        os.homedir(),
        ".pi/agent/workflows/wf/agents/1-sync/structured.json",
      ),
      outputBytes: 53_000,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      transcript: [],
    },
  ];
  return details;
}

test("the settled tool result lists artifacts from a failed agent", () => {
  const message = buildWorkflowResultMessage(detailsWithFailedArtifact(), "/tmp/wf");
  const outputFile = path.join(os.homedir(), ".pi/agent/workflows/wf/agents/1-sync/output.md");
  assert.ok(message.includes(`output: ${outputFile} (53000 bytes)`));
  assert.ok(!message.includes(`output: ~${path.sep}`));
});

test("the saved report lists artifacts from a failed agent", () => {
  const report = buildReport(detailsWithFailedArtifact());
  const artifactRoot = ["~", ".pi", "agent", "workflows", "wf", "agents", "1-sync"].join(path.sep);
  assert.ok(report.includes(`output: ${artifactRoot}${path.sep}output.md`));
  assert.ok(report.includes(`structured: ${artifactRoot}${path.sep}structured.json`));
});
