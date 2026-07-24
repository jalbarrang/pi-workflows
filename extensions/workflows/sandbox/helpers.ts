import { AGENT_OPTION_KEYS } from "./option-keys.ts";
import type { SandboxAgentOptions } from "./types.ts";

export const byteLength = (value: string) => Buffer.byteLength(value);
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export interface SanitizedAgentOptions {
  options: SandboxAgentOptions;
  /** Keys the script passed that the DSL does not define. Never silently dropped. */
  unknownKeys: string[];
}

export function sanitizeOptions(value: Record<string, unknown>): SanitizedAgentOptions {
  const picked = AGENT_OPTION_KEYS.flatMap((key) =>
    value[key] === undefined ? [] : [[key, value[key]] as const],
  );
  const known = new Set<string>(AGENT_OPTION_KEYS);
  return {
    options: Object.fromEntries(picked) as SandboxAgentOptions,
    unknownKeys: Object.keys(value).filter((key) => !known.has(key)),
  };
}
