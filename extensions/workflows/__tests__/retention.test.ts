import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { sweepRunDirectories } from "../artifacts/index.ts";

const hex = (index: number) => index.toString(16).padStart(12, "0");

/** Build `count` run dirs, oldest first, each with metadata and an agent payload. */
function seed(count: number) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wf-retention-"));
  const names: string[] = [];
  for (let index = 0; index < count; index++) {
    const name = `wf_${hex(index)}`;
    names.push(name);
    fs.mkdirSync(path.join(root, name, "agents", "0-recon"), { recursive: true });
    fs.writeFileSync(path.join(root, name, "workflow.json"), "{}");
    fs.writeFileSync(path.join(root, name, "result.json"), "{}");
    fs.writeFileSync(path.join(root, name, "agents", "0-recon", "output.md"), "report");
    const stamp = new Date(1_000_000 + index * 10_000);
    fs.utimesSync(path.join(root, name), stamp, stamp);
  }
  return { root, names };
}

const has = (root: string, ...parts: string[]) => fs.existsSync(path.join(root, ...parts));

test("the newest runs keep everything and the oldest are removed entirely", () => {
  const { root, names } = seed(12);
  sweepRunDirectories(root, { keepArtifacts: 3, keepRuns: 6 });
  const newest = names.slice(-3);
  for (const name of newest) assert.equal(has(root, name, "agents", "0-recon", "output.md"), true);
  const oldest = names.slice(0, 6);
  for (const name of oldest) assert.equal(has(root, name), false, `${name} should be gone`);
});

test("middle-aged runs lose their payloads but stay resumable and listable", () => {
  const { root, names } = seed(12);
  sweepRunDirectories(root, { keepArtifacts: 3, keepRuns: 6 });
  for (const name of names.slice(6, 9)) {
    assert.equal(has(root, name, "agents"), false, `${name} should have lost its payloads`);
    assert.equal(has(root, name, "result.json"), true, `${name} must stay resumable`);
    assert.equal(has(root, name, "workflow.json"), true, `${name} must stay listable`);
  }
});

test("an active run is never touched, however old it is", () => {
  const { root, names } = seed(12);
  const oldest = names[0]!;
  sweepRunDirectories(root, { keepArtifacts: 3, keepRuns: 6, protect: [oldest] });
  assert.equal(has(root, oldest, "agents", "0-recon", "output.md"), true);
});

test("nothing that is not a run directory is ever removed", () => {
  const { root } = seed(12);
  fs.mkdirSync(path.join(root, "not-a-run"));
  fs.writeFileSync(path.join(root, "notes.md"), "keep me");
  sweepRunDirectories(root, { keepArtifacts: 1, keepRuns: 1 });
  assert.equal(has(root, "not-a-run"), true);
  assert.equal(has(root, "notes.md"), true);
});

test("a missing or unreadable directory is not an error", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wf-retention-"));
  sweepRunDirectories(path.join(root, "absent"));
  assert.equal(fs.existsSync(path.join(root, "absent")), false);
});
