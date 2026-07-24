import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkflowPersistence } from "../artifacts/index.ts";
import type { WorkflowDetails } from "../run/types.ts";
import { workflowDetails } from "./fixtures.ts";

test("workflow checkpoints throttle updates and support immediate/final flushes", async () => {
  const details = workflowDetails();
  const snapshots: WorkflowDetails[] = [];
  const persistence = createWorkflowPersistence("fixture", details, {
    intervalMs: 15,
    persist: (_runDir, current) => snapshots.push(structuredClone(current)),
  });
  details.currentPhase = "Scan";
  persistence.checkpoint();
  details.currentPhase = "Review";
  persistence.checkpoint();
  assert.equal(snapshots.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.currentPhase, "Review");
  details.status = "completed";
  persistence.checkpoint({ immediate: true });
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1]?.status, "completed");
  details.finishedAt = 3;
  persistence.flush();
  assert.equal(snapshots.length, 3);
  assert.equal(snapshots[2]?.finishedAt, 3);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(snapshots.length, 3);
});
