import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createWriteFence, matchesWriteScope } from "../agent/write-scope.ts";
import { checkCommand, explainDenial, parseMkdir } from "../policy/index.ts";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "pi-workflow-fenced-"));
  mkdirSync(join(root, "src/quests"), { recursive: true });
  mkdirSync(join(root, "server"), { recursive: true });
  return root;
}

test("a subtree glob matches the directory itself, so a directory can be relocated", () => {
  assert.equal(matchesWriteScope("src/quests", ["src/quests/**"]), true);
  assert.equal(matchesWriteScope("src/quests/a.ts", ["src/quests/**"]), true);
  assert.equal(matchesWriteScope("src/quests-old", ["src/quests/**"]), false);
  assert.equal(matchesWriteScope("src", ["src/quests/**"]), false);
  // A non-subtree glob is unchanged: `*` still stops at a separator.
  assert.equal(matchesWriteScope("src/quests", ["src/*"]), true);
  assert.equal(matchesWriteScope("src/quests/a.ts", ["src/*"]), false);
});

test("a directory-level git mv inside one subtree glob is permitted", () => {
  const root = repo();
  try {
    const fence = createWriteFence(root, ["src/**"]);
    const decision = checkCommand("git mv src/quests src/domain", undefined, fence);
    assert.equal(decision.allowed, true, decision.reason ?? "denied");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mkdir is permitted inside the fence and refused outside it", () => {
  const root = repo();
  try {
    const fence = createWriteFence(root, ["src/**"]);
    assert.equal(checkCommand("mkdir -p src/quests/verifiers", undefined, fence).allowed, true);
    assert.equal(checkCommand("mkdir src/other", undefined, fence).allowed, true);
    const outside = checkCommand("mkdir -p server/x", undefined, fence);
    assert.equal(outside.allowed, false);
    assert.match(outside.reason ?? "", /outside this agent's writeScope/);
    // No fence at all: unchanged from before, mkdir stays denied.
    assert.equal(checkCommand("mkdir -p src/x").allowed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mkdir is recognized narrowly and names what is wrong", () => {
  assert.match(parseMkdir("mkdir -m 777 src/x").reason ?? "", /flag "-m" is not permitted/);
  assert.match(parseMkdir("mkdir a b").reason ?? "", /exactly one directory path/);
  assert.match(parseMkdir("mkdir -p src/x && rm -rf .").reason ?? "", /no pipes/);
  assert.equal(parseMkdir("rmdir src/x").recognized, false);
  assert.deepEqual(parseMkdir("mkdir -p src/x").request, { verb: "mkdir", paths: ["src/x"] });
});

test("a denial names the blocked segment and flags unwidenable constructs", () => {
  const gate = "find . -name '*.ts' | while read f; do wc -l $f; done | awk '$1 >= 100'";
  const reason = explainDenial(gate, {});
  assert.match(reason, /The blocked part is `while read f/);
  assert.match(reason, /shell control flow \(while\/for\/if\) is never runnable/);
  assert.match(reason, /find … -exec wc -l \{\} \+/);
  assert.match(explainDenial("echo $(ls)", {}), /command substitution is refused/);
  assert.match(explainDenial("npm run build 2>&1", {}), /output redirects are refused/);
  assert.match(explainDenial("COUNT=3 wc -l file", {}), /inline environment assignments/);
  // A plain refusal still points at the mechanism that can widen it.
  assert.match(explainDenial("npm run build", {}), /widen them with allowCommands/);
});
