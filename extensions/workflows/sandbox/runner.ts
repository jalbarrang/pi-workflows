import { safeStringify } from "../artifacts/index.ts";
import { byteLength } from "./helpers.ts";
import { MAX_ARGS_BYTES, MAX_SOURCE_BYTES } from "./limits.ts";
import { spawnSandbox } from "./spawn.ts";
import type { RunWorkflowSandboxOptions } from "./types.ts";

export function runWorkflowSandbox(options: RunWorkflowSandboxOptions) {
  if (!process.allowedNodeEnvironmentFlags.has("--permission")) {
    return Promise.reject(new Error("This Node runtime cannot enforce workflow child permissions"));
  }
  if (byteLength(options.source) > MAX_SOURCE_BYTES) {
    return Promise.reject(new Error(`Workflow script exceeds the ${MAX_SOURCE_BYTES} byte limit`));
  }
  const argsJson = safeStringify(
    { defined: options.args !== undefined, value: options.args },
    { maxBytes: MAX_ARGS_BYTES, maxDepth: 16, maxNodes: 10_000 },
  );
  if (byteLength(argsJson) > MAX_ARGS_BYTES) {
    return Promise.reject(new Error("Workflow args exceed the IPC limit"));
  }
  return spawnSandbox(options, options.source, argsJson);
}
