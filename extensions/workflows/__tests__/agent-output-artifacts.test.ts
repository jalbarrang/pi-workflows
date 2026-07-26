import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { OUTPUT_MAX_BYTES } from "../agent/index.ts";
import { writeAgentArtifacts } from "../artifacts/index.ts";
import { agentSlug } from "../artifacts/agent-slug.ts";

const runDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "wf-artifacts-"));
const agent = (label: string, index = 0) => ({ index, label });

test("a full answer reaches disk even when the inline output is capped", () => {
  const dir = runDir();
  const output = "x".repeat(OUTPUT_MAX_BYTES * 2);
  const written = writeAgentArtifacts(dir, agent("recon:rows"), { output });
  assert.ok(written);
  assert.equal(written.outputFile, path.join(dir, "agents", "0-recon-rows", "output.md"));
  assert.equal(written.outputBytes, output.length);
  assert.equal(fs.readFileSync(written.outputFile, "utf8"), output);
});

test("a structured payload larger than the transcript cap survives intact", () => {
  const dir = runDir();
  // 16KB is the cap that destroyed the recon payloads in run wf_2cf06cc43747.
  const structured = { verbatim: "v".repeat(64 * 1024), facts: [{ claim: "c", evidence: "e" }] };
  const written = writeAgentArtifacts(dir, agent("schema", 2), { output: "summary", structured });
  assert.ok(written?.structuredFile);
  assert.equal(written.structuredFile, path.join(dir, "agents", "2-schema", "structured.json"));
  const parsed: unknown = JSON.parse(fs.readFileSync(written.structuredFile, "utf8"));
  assert.deepEqual(parsed, structured);
});

test("a failed agent's partial output is still preserved", () => {
  const dir = runDir();
  const written = writeAgentArtifacts(dir, agent("died-midway"), { output: "half an answer" });
  assert.ok(written);
  assert.equal(fs.readFileSync(written.outputFile, "utf8"), "half an answer");
});

test("no label can place an artifact outside the run directory", () => {
  const dir = runDir();
  fs.mkdirSync(path.join(dir, "agents"), { recursive: true });
  const agentsRoot = fs.realpathSync(path.join(dir, "agents"));
  const labels = ["../../escape", "recon:rows", "", "..", "/etc/passwd", "..\\..\\win"];
  for (const [index, label] of labels.entries()) {
    const written = writeAgentArtifacts(dir, agent(label, index), { output: "contained" });
    assert.ok(written, `label ${JSON.stringify(label)} produced no artifact`);
    const parent = fs.realpathSync(path.dirname(written.outputFile));
    assert.equal(
      parent.startsWith(`${agentsRoot}${path.sep}`),
      true,
      `label ${JSON.stringify(label)} escaped to ${parent}`,
    );
  }
});

test("the slug keeps only characters that cannot form a path", () => {
  assert.equal(agentSlug("../../escape"), "escape");
  assert.equal(agentSlug("recon:rows"), "recon-rows");
  assert.equal(agentSlug("..."), "agent");
  assert.equal(agentSlug(""), "agent");
  assert.equal(agentSlug("a".repeat(200)).length, 48);
});

test("an unwritable run directory is not an agent failure", () => {
  const dir = runDir();
  // A file where the agents/ directory must go: mkdir fails, the writer reports
  // nothing, and the caller keeps its otherwise successful outcome.
  fs.writeFileSync(path.join(dir, "agents"), "not a directory");
  assert.equal(writeAgentArtifacts(dir, agent("blocked"), { output: "answer" }), undefined);
});
