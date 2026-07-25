import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { test } from "node:test";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { loadPreviousResult, MAX_RESUME_BYTES } from "../artifacts/resume.ts";
import { runSandbox } from "./sandbox-fixture.ts";

const runsDir = () => path.join(getAgentDir(), "workflows");
function seedRun(runId: string, contents?: string) {
  const dir = path.join(runsDir(), runId);
  mkdirSync(dir, { recursive: true });
  if (contents !== undefined) writeFileSync(path.join(dir, "result.json"), contents);
  return () => rmSync(dir, { recursive: true, force: true });
}

test("a previous result is loaded verbatim", () => {
  const cleanup = seedRun("wf_aaaaaaaaaaaa", '{"blocking":[],"gates":"green"}');
  try {
    assert.equal(loadPreviousResult("wf_aaaaaaaaaaaa"), '{"blocking":[],"gates":"green"}');
  } finally {
    cleanup();
  }
});

test("a run id that is not a run id is refused instead of becoming a path", () => {
  for (const id of ["../../etc", "wf_../../x", "wf_ZZZZZZZZZZZZ", "wf_abc", "", "wf_"]) {
    assert.throws(() => loadPreviousResult(id), /Invalid resume run id/, `accepted ${id}`);
  }
});

test("a run with no result, bad JSON, or an oversized result is rejected clearly", () => {
  const empty = seedRun("wf_bbbbbbbbbbbb");
  const broken = seedRun("wf_cccccccccccc", "{not json");
  const huge = seedRun("wf_dddddddddddd", `"${"x".repeat(MAX_RESUME_BYTES)}"`);
  try {
    assert.throws(() => loadPreviousResult("wf_bbbbbbbbbbbb"), /has no result\.json/);
    assert.throws(() => loadPreviousResult("wf_cccccccccccc"), /not valid JSON/);
    assert.throws(() => loadPreviousResult("wf_dddddddddddd"), /resume limit/);
  } finally {
    empty();
    broken();
    huge();
  }
});

test("a resumed script sees previous and cannot mutate it", async () => {
  const script = `
    let refused = false;
    try { previous.gates = "tampered"; } catch { refused = true; }
    return { seen: previous.gates, refused };
  `;
  assert.deepEqual(await runSandbox(script, { previousJson: '{"gates":"green"}' }), {
    seen: "green",
    refused: true,
  });
});

test("an unresumed script sees previous as undefined", async () => {
  assert.deepEqual(await runSandbox("return { resumed: previous !== undefined };"), {
    resumed: false,
  });
});

test("previous is independent of args", async () => {
  const result = await runSandbox("return { args, previous };", {
    args: { plan: 5 },
    previousJson: '{"phase":"Review"}',
  });
  assert.deepEqual(result, { args: { plan: 5 }, previous: { phase: "Review" } });
});
