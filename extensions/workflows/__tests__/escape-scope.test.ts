import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildChildCustomTools } from "../agent/child-tools.ts";
import { createScopedWriteTools } from "../agent/scoped-tools.ts";
import { checkCommand } from "../policy/index.ts";
import type { RunAgentOptions } from "../agent/types.ts";

const base = { prompt: "p", cwd: process.cwd() } as unknown as RunAgentOptions;
const names = (options: Partial<RunAgentOptions>) =>
  buildChildCustomTools({ ...base, ...options } as RunAgentOptions, () => {}).map(
    (tool) => tool.name,
  );

test("an unscoped agent gets zero custom tools, so defaults match upstream", () => {
  assert.deepEqual(names({}), []);
  assert.deepEqual(names({ checkCommand }), []);
});

test("each scoping mode installs exactly the tools it needs", () => {
  assert.deepEqual(names({ schema: { type: "object" } }), ["structured_output"]);
  assert.deepEqual(names({ readOnly: true, policyGoverned: true, checkCommand }), ["bash"]);
  assert.deepEqual(names({ writeScope: ["client/**"], policyGoverned: true, checkCommand }), [
    "bash",
    "write",
    "edit",
  ]);
});

test("a write scope never installs write tools for a read-only agent", () => {
  const installed = names({
    readOnly: true,
    writeScope: ["client/**"],
    policyGoverned: true,
    checkCommand,
  });
  assert.deepEqual(installed, ["bash"]);
});

test("scoped write and edit both reject paths outside the fence", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-workflow-escape-"));
  mkdirSync(join(root, "client"), { recursive: true });
  try {
    const [write, edit] = createScopedWriteTools(root, ["client/**"]);
    const attempts = [
      "server/app.ts",
      "../outside.ts",
      "/etc/hosts",
      "client/../server/app.ts",
      "@server/app.ts",
    ];
    for (const path of attempts) {
      await assert.rejects(
        () => write.execute("c", { path, content: "x" }, undefined, undefined, undefined as never),
        /writeScope|outside the workflow cwd/,
        `write allowed ${path}`,
      );
      await assert.rejects(
        () =>
          edit.execute(
            "c",
            { path, edits: [{ oldText: "a", newText: "b" }] },
            undefined,
            undefined,
            undefined as never,
          ),
        /writeScope|outside the workflow cwd/,
        `edit allowed ${path}`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
