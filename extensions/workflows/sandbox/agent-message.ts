import { toSerializable } from "../artifacts/index.ts";
import { byteLength, errorText, isRecord, sanitizeOptions } from "./helpers.ts";
import { MAX_AGENT_MESSAGE_BYTES, MAX_AGENT_REQUESTS, MAX_PROMPT_CHARS } from "./limits.ts";
import type { SandboxState } from "./state.ts";
import type { SandboxAgentResult } from "./types.ts";

export function handleAgentMessage(state: SandboxState, rawJson: unknown) {
  if (typeof rawJson !== "string" || byteLength(rawJson) > MAX_AGENT_MESSAGE_BYTES) {
    return state.finish(new Error("Workflow sandbox sent an oversized agent request"));
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    return state.finish(new Error("Workflow sandbox sent malformed agent JSON"));
  }
  const valid =
    isRecord(payload) &&
    Number.isSafeInteger(payload.id) &&
    typeof payload.id === "number" &&
    payload.id > 0 &&
    typeof payload.prompt === "string" &&
    payload.prompt.length <= MAX_PROMPT_CHARS &&
    isRecord(payload.options);
  if (!valid) return state.finish(new Error("Workflow sandbox sent an invalid agent request"));
  const request = payload as { id: number; prompt: string; options: Record<string, unknown> };
  if (state.requestIds.has(request.id) || ++state.requestCount > MAX_AGENT_REQUESTS) {
    return state.finish(new Error("Workflow sandbox exceeded its agent request budget"));
  }
  state.requestIds.add(request.id);
  const controller = new AbortController();
  state.active.set(request.id, controller);
  const sendResult = (result: SandboxAgentResult) => {
    if (!state.active.delete(request.id) || state.finished || !state.child.connected) return;
    const normalized = toSerializable(result, {
      maxDepth: 16,
      maxNodes: 10_000,
      maxStringBytes: 128 * 1024,
    });
    let resultJson = JSON.stringify(normalized);
    if (byteLength(resultJson) > MAX_AGENT_MESSAGE_BYTES) {
      resultJson = JSON.stringify({
        ok: false,
        output: "",
        error: "Agent result exceeded the workflow IPC output limit",
      });
    }
    state.child.send({ token: state.token, kind: "agentResult", id: request.id, resultJson });
  };
  const sanitized = sanitizeOptions(request.options);
  void state.options
    .onAgent(request.prompt, sanitized.options, controller.signal, sanitized.unknownKeys)
    .then(sendResult)
    .catch((error) => sendResult({ ok: false, output: "", error: errorText(error) }));
}
