export const DEFAULT_MAX_BYTES = 1024 * 1024;
export const DEFAULT_MAX_DEPTH = 16;
export const DEFAULT_MAX_NODES = 20_000;
export const DEFAULT_MAX_STRING_BYTES = 64 * 1024;
export const TRANSCRIPT_MAX_BYTES = 32 * 1024;
export const TRANSCRIPT_ENTRY_MAX_BYTES = 8 * 1024;
export const CHECKPOINT_INTERVAL_MS = 500;
/**
 * Per-agent output artifacts are bounded far more loosely than every other
 * channel because nothing forwards them: they are written straight to disk and
 * read back by a later agent's `read` tool, so no host buffer, IPC frame, or
 * rendered transcript has to absorb them.
 */
export const AGENT_ARTIFACT_MAX_BYTES = 8 * 1024 * 1024;
export const AGENT_ARTIFACT_MAX_NODES = 200_000;
