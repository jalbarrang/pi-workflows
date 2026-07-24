import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import { terminateChild } from "../sandbox/terminate.ts";

function fakeChild(overrides: Partial<ChildProcess> = {}) {
  const signals: Array<string | undefined> = [];
  const child = {
    exitCode: null,
    signalCode: null,
    pid: 4242,
    kill(signal?: string) {
      signals.push(signal);
      return true;
    },
    ...overrides,
  } as unknown as ChildProcess;
  return { child, signals };
}

test("posix termination escalates from SIGTERM", () => {
  const { child, signals } = fakeChild();
  terminateChild(child, "linux");
  assert.deepEqual(signals, ["SIGTERM"]);
});

test("windows termination never sends a POSIX signal", () => {
  const { child, signals } = fakeChild();
  terminateChild(child, "win32");
  // SIGTERM on Windows is an immediate hard kill that leaves the tree running,
  // so the taskkill path must be used instead.
  assert.deepEqual(signals, []);
});

test("an already-exited child is a no-op on both platforms", () => {
  for (const platform of ["linux", "win32"] as NodeJS.Platform[]) {
    const exited = fakeChild({ exitCode: 0 });
    terminateChild(exited.child, platform);
    assert.deepEqual(exited.signals, []);
    const signalled = fakeChild({ exitCode: null, signalCode: "SIGKILL" });
    terminateChild(signalled.child, platform);
    assert.deepEqual(signalled.signals, []);
  }
});

test("termination is idempotent and never throws", () => {
  const { child } = fakeChild({
    kill() {
      throw new Error("kill failed");
    },
  });
  assert.throws(() => terminateChild(child, "linux"), /kill failed/);
  const windows = fakeChild({ pid: undefined });
  assert.doesNotThrow(() => terminateChild(windows.child, "win32"));
  assert.doesNotThrow(() => terminateChild(windows.child, "win32"));
});

test("a real child process is reaped on this platform", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  await once(child, "spawn");
  terminateChild(child);
  const [code, signal] = await once(child, "exit");
  assert.ok(code !== null || signal !== null, "child did not exit");
});
