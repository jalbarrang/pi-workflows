import { byteLength, isRecord } from "./helpers.ts";
import { MAX_AGENT_MESSAGE_BYTES, MAX_PROMPT_CHARS } from "./limits.ts";

export interface AgentRequest {
  id: number;
  prompt: string;
  options: Record<string, unknown>;
}

/**
 * Three outcomes, and the distinction is the point.
 *
 * `fatal` is a protocol violation: the message cannot be attributed to a call, so
 * the run cannot continue coherently. `reject` is an author error in one
 * `agent()` call — the id is known, so exactly that call fails and the rest of
 * the run, including every result already paid for, survives.
 */
export type AgentRequestCheck =
  | { kind: "ok"; request: AgentRequest }
  | { kind: "reject"; id: number; error: string }
  | { kind: "fatal"; error: string };

export function oversizedPromptError(size: number, unit: "characters" | "bytes", limit: number) {
  return (
    `agent() prompt is ${size} ${unit}, over the ${limit} ${unit} limit. ` +
    "Pass the previous agent's outputFile path and tell it to read that file, " +
    "instead of interpolating the previous output into this prompt."
  );
}

/**
 * Validate one agent request, preferring a per-call rejection wherever the id is
 * recoverable.
 *
 * The size guard runs before `JSON.parse` on purpose: parsing an unbounded
 * payload is the denial-of-service the byte cap exists to prevent, and the
 * envelope id means refusing it no longer costs the run.
 */
export function checkAgentRequest(id: unknown, rawJson: unknown): AgentRequestCheck {
  if (!Number.isSafeInteger(id) || typeof id !== "number" || id <= 0) {
    return { kind: "fatal", error: "Workflow sandbox sent an unattributable agent request" };
  }
  if (typeof rawJson !== "string") {
    return { kind: "fatal", error: "Workflow sandbox sent a malformed agent request" };
  }
  const bytes = byteLength(rawJson);
  if (bytes > MAX_AGENT_MESSAGE_BYTES) {
    return {
      kind: "reject",
      id,
      error: oversizedPromptError(bytes, "bytes", MAX_AGENT_MESSAGE_BYTES),
    };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    return { kind: "fatal", error: "Workflow sandbox sent malformed agent JSON" };
  }
  if (!isRecord(payload) || typeof payload.prompt !== "string" || !isRecord(payload.options)) {
    return { kind: "fatal", error: "Workflow sandbox sent an invalid agent request" };
  }
  if (payload.prompt.length > MAX_PROMPT_CHARS) {
    const error = oversizedPromptError(payload.prompt.length, "characters", MAX_PROMPT_CHARS);
    return { kind: "reject", id, error };
  }
  return { kind: "ok", request: { id, prompt: payload.prompt, options: payload.options } };
}
