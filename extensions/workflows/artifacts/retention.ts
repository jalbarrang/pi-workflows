import * as fs from "node:fs";
import * as path from "node:path";
import { KEEP_AGENT_ARTIFACTS, KEEP_RUN_DIRECTORIES } from "./limits.ts";
import { isRunId } from "./run-id.ts";

export interface RetentionOptions {
  /** Runs newer than this keep their `agents/` payloads. */
  keepArtifacts?: number;
  /** Runs newer than this keep their metadata. Older ones are removed entirely. */
  keepRuns?: number;
  /** Run ids that must never be touched, whatever their age. */
  protect?: Iterable<string>;
}

function runDirectories(root: string) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const runs = entries.flatMap((entry) => {
    if (!entry.isDirectory() || !isRunId(entry.name)) return [];
    try {
      return [{ name: entry.name, mtime: fs.statSync(path.join(root, entry.name)).mtimeMs }];
    } catch {
      return [];
    }
  });
  return runs.sort((left, right) => right.mtime - left.mtime);
}

/**
 * Bound what the workflows directory can grow to, in two tiers.
 *
 * Per-agent output artifacts are capped at 8MB each and a run permits 32 agents,
 * so the worst case per run went from a couple of hundred kilobytes to a couple
 * of hundred megabytes. Nothing else prunes this directory.
 *
 * Deleting whole runs on age alone would break the two readers that depend on
 * history: `resume` reads an arbitrary older `result.json`, and `/workflows`
 * lists past runs. So the big payloads are evicted first and the small metadata
 * outlives them — an older run stays listable and resumable after its `agents/`
 * directory is gone.
 *
 * Runs the caller is currently executing are protected regardless of age so a sweep cannot race their writes.
 *
 * Every failure is swallowed: housekeeping must never take down a run.
 */
export function sweepRunDirectories(root: string, options: RetentionOptions = {}) {
  const keepArtifacts = Math.max(1, options.keepArtifacts ?? KEEP_AGENT_ARTIFACTS);
  const keepRuns = Math.max(keepArtifacts, options.keepRuns ?? KEEP_RUN_DIRECTORIES);
  const protectedIds = new Set(options.protect ?? []);
  let runs: { name: string; mtime: number }[];
  try {
    runs = runDirectories(root);
  } catch {
    return;
  }
  for (const [index, run] of runs.entries()) {
    if (index < keepArtifacts || protectedIds.has(run.name)) continue;
    const directory = path.join(root, run.name);
    const target = index < keepRuns ? path.join(directory, "agents") : directory;
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch {}
  }
}
