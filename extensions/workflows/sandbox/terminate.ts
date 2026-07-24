import { spawn, type ChildProcess } from "node:child_process";

/**
 * Terminate the sandbox child on every platform.
 *
 * POSIX gets SIGTERM then SIGKILL. On Windows `kill("SIGTERM")` is already an
 * immediate hard termination and does not reap a process tree, so `taskkill /F
 * /T` is used instead — the same approach pi takes in `killProcessTree`. The
 * child currently spawns nothing, but it runs under `--permission` without
 * `--allow-child-process`, and this keeps teardown correct if that changes.
 *
 * Idempotent and never throws: teardown runs on the failure path too.
 */
const FORCE_KILL_DELAY_MS = 1_000;

function taskkill(child: ChildProcess, pid: number) {
  try {
    const killer = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    // spawn reports failure through an async `error` event, not a throw. Without
    // this listener a missing or failing taskkill becomes an uncaught exception
    // that would take down the host process.
    killer.on("error", () => {
      try {
        child.kill();
      } catch {
        // The child may already be gone; nothing further to try.
      }
    });
    killer.unref();
  } catch {
    // Synchronous spawn failures are equally non-fatal.
  }
}

export function terminateChild(child: ChildProcess, platform: NodeJS.Platform = process.platform) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (platform === "win32") {
    if (typeof child.pid === "number") taskkill(child, child.pid);
    return;
  }
  child.kill("SIGTERM");
  const force = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, FORCE_KILL_DELAY_MS);
  force.unref?.();
}
