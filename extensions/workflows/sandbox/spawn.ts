import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChildEnv } from "./child-env.ts";
import { terminateChild } from "./terminate.ts";
import { handleMessage } from "./messages.ts";
import type { SandboxState } from "./state.ts";
import type { RunWorkflowSandboxOptions } from "./types.ts";

export function spawnSandbox(options: RunWorkflowSandboxOptions, source: string, argsJson: string) {
  return new Promise<unknown>((resolve, reject) => {
    const worker = fileURLToPath(new URL("./sandbox-child.cjs", import.meta.url));
    const child = spawn(
      process.execPath,
      [
        "--permission",
        `--allow-fs-read=${path.dirname(worker)}`,
        "--max-old-space-size=128",
        "--stack-size=2048",
        worker,
      ],
      {
        cwd: options.cwd,
        env: buildChildEnv(),
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
    const state: SandboxState = {
      child,
      options,
      token: randomBytes(24).toString("hex"),
      requestIds: new Set(),
      active: new Map(),
      requestCount: 0,
      finished: false,
      resolve,
      reject,
      finish(error, value) {
        if (state.finished) return;
        state.finished = true;
        options.signal.removeEventListener("abort", abort);
        for (const controller of state.active.values()) {
          controller.abort(new Error("Workflow stopped"));
        }
        state.active.clear();
        child.removeAllListeners();
        terminateChild(child);
        if (error) reject(error);
        else resolve(value);
      },
    };
    const abort = () => state.finish(new Error("Workflow was aborted"));
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) return abort();
    child.on("error", (error) => state.finish(error));
    child.on("exit", (code, signal) => {
      if (!state.finished) {
        state.finish(
          new Error(`Workflow sandbox exited before completion (${signal ?? code ?? "unknown"})`),
        );
      }
    });
    child.on("message", (message) => handleMessage(state, message));
    child.send({ kind: "init", token: state.token, source, argsJson }, (error) => {
      if (error) state.finish(error);
    });
  });
}
