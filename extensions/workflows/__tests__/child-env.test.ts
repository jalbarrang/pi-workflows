import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChildEnv, resolvePathKey } from "../sandbox/child-env.ts";

const windowsEnv = {
  Path: "C:\\bin",
  SystemRoot: "C:\\Windows",
  TEMP: "C:\\Temp",
  USERPROFILE: "C:\\Users\\dev",
  SECRET_TOKEN: "leak",
};

test("the PATH key is found regardless of casing", () => {
  assert.equal(resolvePathKey({ PATH: "/usr/bin" }), "PATH");
  assert.equal(resolvePathKey({ Path: "C:\\bin" }), "Path");
  assert.equal(resolvePathKey({ path: "/usr/bin" }), "path");
  assert.equal(resolvePathKey({}), "PATH");
});

test("posix children receive only PATH and NODE_NO_WARNINGS", () => {
  const env = buildChildEnv({ PATH: "/usr/bin", HOME: "/home/dev", SECRET: "leak" }, "linux");
  assert.deepEqual(env, { PATH: "/usr/bin", NODE_NO_WARNINGS: "1" });
});

test("windows children receive the correctly cased path plus required extras only", () => {
  const env = buildChildEnv(windowsEnv, "win32");
  // assert.deepEqual narrows its argument, so the negative checks come first.
  assert.equal(env.PATH, undefined, "an uppercase PATH would shadow the real Path");
  assert.equal(env.SECRET_TOKEN, undefined, "parent secrets must not reach the sandbox");
  // Exhaustive by construction: anything not listed here is not forwarded.
  assert.deepEqual(env, {
    Path: "C:\\bin",
    NODE_NO_WARNINGS: "1",
    SystemRoot: "C:\\Windows",
    TEMP: "C:\\Temp",
  });
});

test("windows extras are omitted when the parent lacks them", () => {
  const env = buildChildEnv({ Path: "C:\\bin" }, "win32");
  assert.deepEqual(env, { Path: "C:\\bin", NODE_NO_WARNINGS: "1" });
});

test("a missing path variable yields an empty value, never undefined", () => {
  assert.deepEqual(buildChildEnv({}, "linux"), { PATH: "", NODE_NO_WARNINGS: "1" });
});
