import type { ChildProcess } from "node:child_process";
import type { RunWorkflowSandboxOptions } from "./types.ts";

export interface SandboxState {
  child: ChildProcess;
  options: RunWorkflowSandboxOptions;
  token: string;
  requestIds: Set<number>;
  active: Map<number, AbortController>;
  requestCount: number;
  finished: boolean;
  resolve(value: unknown): void;
  reject(error: Error): void;
  finish(error?: Error, value?: unknown): void;
}
