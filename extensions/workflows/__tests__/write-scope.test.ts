import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkWriteScope, matchesWriteScope, resolveScopedPath } from "../agent/write-scope.ts";
import { resolveAgentOptions } from "../run/agent-options.ts";

const context = { model: undefined, modelRegistry: { find: () => undefined, getAll: () => [] } };
const resolve = (options: Record<string, unknown>) =>
  resolveAgentOptions(options, context as never, "high");

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "pi-workflow-scope-"));
  mkdirSync(join(root, "client", "src"), { recursive: true });
  mkdirSync(join(root, "server"), { recursive: true });
  mkdirSync(join(root, "outside"), { recursive: true });
  writeFileSync(join(root, "outside", "secret.txt"), "x");
  return root;
}

test("globs match within a segment for * and across segments for **", () => {
  assert.equal(matchesWriteScope("client/src/app.ts", ["client/**"]), true);
  assert.equal(matchesWriteScope("client/app.ts", ["client/*.ts"]), true);
  assert.equal(matchesWriteScope("client/src/app.ts", ["client/*.ts"]), false);
  assert.equal(matchesWriteScope("server/app.ts", ["client/**"]), false);
});

test("in-scope paths resolve and out-of-cwd paths are refused", () => {
  const root = workspace();
  try {
    assert.equal(resolveScopedPath(root, "client/src/app.ts"), "client/src/app.ts");
    assert.equal(resolveScopedPath(root, "@client/src/app.ts"), "client/src/app.ts");
    assert.equal(resolveScopedPath(root, "../escape.ts"), undefined);
    assert.equal(resolveScopedPath(root, "client/../../escape.ts"), undefined);
    assert.equal(resolveScopedPath(root, "/etc/hosts"), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writes outside the scope are denied with an actionable reason", () => {
  const root = workspace();
  try {
    const globs = ["client/**"];
    assert.equal(checkWriteScope(root, "client/src/app.ts", globs).allowed, true);
    assert.match(
      checkWriteScope(root, "server/app.ts", globs).reason ?? "",
      /outside this agent's writeScope \(client\/\*\*\)/,
    );
    assert.match(
      checkWriteScope(root, "../escape.ts", globs).reason ?? "",
      /outside the workflow cwd/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlink inside the scope cannot redirect writes outside it", () => {
  const root = workspace();
  try {
    symlinkSync(join(root, "outside"), join(root, "client", "link"), "dir");
    const decision = checkWriteScope(root, "client/link/secret.txt", ["client/**"]);
    assert.equal(decision.allowed, false, "symlink escape was allowed");
    assert.match(decision.reason ?? "", /writeScope|outside the workflow cwd/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("case-only variants cannot bypass a scope on case-insensitive filesystems", () => {
  const root = workspace();
  try {
    const relativePath = resolveScopedPath(root, "Client/src/app.ts");
    // On a case-insensitive filesystem the native realpath restores "client";
    // on a case-sensitive one the path simply stays outside the glob.
    const allowed = relativePath !== undefined && matchesWriteScope(relativePath, ["client/**"]);
    assert.equal(allowed, relativePath === "client/src/app.ts");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeScope governs bash and rejects redundant or malformed use", () => {
  const scoped = resolve({ writeScope: ["client/**"] }).resolved;
  assert.equal(scoped?.policyGoverned, true, "a fence bash can write around is not a fence");
  assert.deepEqual(scoped?.writeScope, ["client/**"]);
  assert.match(
    resolve({ writeScope: ["client/**"], tools: "read-only" }).error ?? "",
    /redundant with `tools: "read-only"`/,
  );
  assert.match(resolve({ writeScope: [] }).error ?? "", /non-empty array of path globs/);
  assert.equal(resolve({}).resolved?.policyGoverned, false);
});
