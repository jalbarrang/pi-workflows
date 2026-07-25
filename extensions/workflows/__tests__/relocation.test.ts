import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createWriteFence } from "../agent/write-scope.ts";
import { checkCommand } from "../policy/index.ts";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "pi-workflow-relocate-"));
  mkdirSync(join(root, "client/src"), { recursive: true });
  mkdirSync(join(root, "server"), { recursive: true });
  writeFileSync(join(root, "client/src/a.ts"), "x");
  return root;
}

test("a git mv with both paths inside the fence is permitted", () => {
  const root = repo();
  try {
    const fence = createWriteFence(root, ["client/**"]);
    const decision = checkCommand("git mv client/src/a.ts client/src/b.ts", undefined, fence);
    assert.equal(decision.allowed, true, decision.reason ?? "denied");
    assert.equal(
      checkCommand("git mv -v client/src/a.ts client/src/b.ts", [], fence).allowed,
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a git mv that leaves the fence is denied, and says which path did", () => {
  const root = repo();
  try {
    const fence = createWriteFence(root, ["client/**"]);
    const out = checkCommand("git mv client/src/a.ts server/a.ts", undefined, fence);
    assert.equal(out.allowed, false);
    assert.match(
      out.reason ?? "",
      /server\/a\.ts, outside this agent's writeScope \(client\/\*\*\)/,
    );
    assert.equal(checkCommand("git mv ../a.ts client/a.ts", undefined, fence).allowed, false);
    assert.equal(checkCommand("git mv /etc/hosts client/a.ts", undefined, fence).allowed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlink out of the fence cannot be relocated through", () => {
  const root = repo();
  try {
    symlinkSync(join(root, "server"), join(root, "client/link"));
    const fence = createWriteFence(root, ["client/**"]);
    const decision = checkCommand("git mv client/src/a.ts client/link/a.ts", undefined, fence);
    assert.equal(decision.allowed, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relocation is unavailable without a fence, and never widens plain movers", () => {
  const root = repo();
  try {
    const fence = createWriteFence(root, ["client/**"]);
    // No fence: a read-only agent has none, so git mv stays denied.
    assert.equal(checkCommand("git mv client/src/a.ts client/src/b.ts").allowed, false);
    for (const command of ["mv client/a client/b", "cp client/a client/b", "rm client/a"]) {
      assert.equal(checkCommand(command, ["git mv *"], fence).allowed, false, command);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a relocation without a fence explains that a writeScope is required", () => {
  const decision = checkCommand("git mv client/a client/b");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /only permitted for an agent with a writeScope/);
});
