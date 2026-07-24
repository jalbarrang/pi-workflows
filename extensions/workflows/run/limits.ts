export const MAX_AGENT_CALLS = 32;
export const MAX_CONCURRENCY = 4;
export const RUN_SHUTDOWN_TIMEOUT_MS = 8_000;
export const FIRST_RESPONSE_TIMEOUT_MS = 45_000;
export const TOOL_TIMEOUT_MS = 180_000;
/** Ceiling for a per-agent `toolTimeoutMs` override. Build gates are slow, hangs are not. */
export const MAX_TOOL_TIMEOUT_MS = 600_000;
export const PROGRESS_INTERVAL_MS = 120;
export const PREVIEW_LENGTH = 200;
