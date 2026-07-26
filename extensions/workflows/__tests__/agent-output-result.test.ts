import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import type { AgentOutcome } from "../agent/index.ts";
import { OUTPUT_MAX_BYTES } from "../agent/index.ts";
import { createOutputPersister } from "../run/agent-artifacts.ts";
import { applyAgentOutcome } from "../run/agent-outcome.ts";
import { RunController } from "../run/controller.ts";
import { WorkflowState } from "../run/state.ts";
import type { RunRuntime } from "../run/runtime.ts";
import type { AgentRecord } from "../run/types.ts";
import { emptyUsage } from "../run/usage.ts";
import { workflowDetails } from "./fixtures.ts";

const runDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "wf-result-"));

test("the script-visible result carries the path, not just the capped text", () => {
  const dir = runDir();
  const record = {
    index: 0,
    label: "recon:rows",
    state: "running",
    startedAt: 1,
    preview: "",
    usage: emptyUsage(),
    transcript: [],
  } as AgentRecord;
  const runtime = {
    runDir: dir,
    controller: new RunController(),
    state: new WorkflowState(workflowDetails()),
    persistence: { checkpoint() {}, flush() {} },
    emit() {},
  } as unknown as RunRuntime;
  const output = "o".repeat(OUTPUT_MAX_BYTES + 10);
  const persisted = createOutputPersister(dir, record)({ output, structured: { ok: true } });
  assert.ok(persisted);
  const outcome = {
    ok: true,
    output: output.slice(0, OUTPUT_MAX_BYTES),
    outputTruncated: true,
    structured: { ok: true },
    outputFile: persisted.outputFile,
    structuredFile: persisted.structuredFile,
    outputBytes: persisted.outputBytes,
    aborted: false,
    usage: emptyUsage(),
    transcript: [],
  } as AgentOutcome;
  const result = applyAgentOutcome(runtime, record, outcome, false);
  assert.equal(result.outputTruncated, true);
  assert.equal(result.outputBytes, output.length);
  assert.equal(result.outputFile, persisted.outputFile);
  assert.equal(record.outputFile, persisted.outputFile);
  assert.equal(fs.readFileSync(result.outputFile ?? "", "utf8"), output);
});

test("an empty answer with no structured payload writes nothing", () => {
  const dir = runDir();
  const record = { index: 0, label: "silent" } as AgentRecord;
  assert.equal(createOutputPersister(dir, record)({ output: "" }), undefined);
  assert.equal(fs.existsSync(path.join(dir, "agents")), false);
});
