import assert from "node:assert/strict";
import { test } from "node:test";
import { runSandbox } from "./sandbox-fixture.ts";

/**
 * Exercises the real permission-mode child against a native path, so drive
 * letters and backslashes are covered on Windows. If Node cannot enforce
 * `--permission` the runner refuses to start rather than degrading, which this
 * asserts explicitly instead of silently skipping.
 */
test("the permission-mode sandbox runs a script and returns its value", async () => {
  assert.ok(
    process.allowedNodeEnvironmentFlags.has("--permission"),
    "this Node runtime cannot enforce the workflow sandbox",
  );
  const result = await runSandbox(`
    phase("Check");
    const reply = await agent("ping");
    return { ok: reply.ok, output: reply.output, platform: typeof process };
  `);
  assert.deepEqual(result, { ok: true, output: "reply:ping", platform: "undefined" });
});

test("the sandbox worker path resolves on this platform's filesystem", async () => {
  // A path-resolution or permission-grant failure surfaces as a spawn/exit error
  // rather than a script error, so any successful return proves the grant worked.
  const result = await runSandbox(`return args === undefined ? "no-args" : "args";`);
  assert.equal(result, "no-args");
});

test("the sandbox receives args across the IPC boundary", async () => {
  const result = await runSandbox(`return args.files.length;`, {
    args: { files: ["a.ts", "b.ts"] },
  });
  assert.equal(result, 2);
});
