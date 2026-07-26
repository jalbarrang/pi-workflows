import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { RUN_ID } from "./run-id.ts";
export const MAX_RESUME_BYTES = 256 * 1024;

/**
 * Load a previous run's returned value so a re-run can reuse it.
 *
 * There is no resuming a script: the sandbox holds no continuation, and a failed
 * run is re-run rather than restarted mid-flight. What a re-run actually needs is
 * the *outputs* of the phases that already succeeded, so a redo of one failed gate
 * does not re-pay for the rest. That is a file on disk, and this reads it.
 *
 * The id is pattern-matched rather than sanitized: a run id is a fixed shape, so
 * anything else is refused instead of being coerced into a path.
 */
export function loadPreviousResult(runId: string): string {
  if (!RUN_ID.test(runId)) {
    throw new Error(
      `Invalid resume run id "${runId}" (expected wf_ followed by 12 hex characters)`,
    );
  }
  const file = path.join(getAgentDir(), "workflows", runId, "result.json");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new Error(
      `Run ${runId} has no result.json to resume from (it failed before returning a value).`,
    );
  }
  if (stat.size > MAX_RESUME_BYTES) {
    throw new Error(`Run ${runId} result.json exceeds the ${MAX_RESUME_BYTES} byte resume limit`);
  }
  const raw = fs.readFileSync(file, "utf8");
  try {
    JSON.parse(raw);
  } catch {
    throw new Error(`Run ${runId} result.json is not valid JSON`);
  }
  return raw;
}
