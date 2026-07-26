import { toSerializable } from "../artifacts/index.ts";
import { handleAgentMessage } from "./agent-message.ts";
import { byteLength, errorText, isRecord } from "./helpers.ts";
import { MAX_PHASE_BYTES, MAX_RESULT_BYTES } from "./limits.ts";
import type { SandboxState } from "./state.ts";

function handlePhase(state: SandboxState, raw: Record<string, unknown>) {
  if (typeof raw.payloadJson !== "string" || byteLength(raw.payloadJson) > MAX_PHASE_BYTES) {
    return state.finish(new Error("Workflow sandbox sent an invalid phase update"));
  }
  try {
    const payload: unknown = JSON.parse(raw.payloadJson);
    if (!isRecord(payload) || typeof payload.title !== "string") throw new Error();
    state.options.onPhase(payload.title.slice(0, 160));
  } catch {
    state.finish(new Error("Workflow sandbox sent an invalid phase update"));
  }
}

function handleResult(state: SandboxState, raw: Record<string, unknown>) {
  if (typeof raw.resultJson !== "string" || byteLength(raw.resultJson) > MAX_RESULT_BYTES) {
    return state.finish(new Error("Workflow result exceeded the IPC limit"));
  }
  try {
    const normalized = toSerializable(JSON.parse(raw.resultJson));
    state.finish(undefined, JSON.parse(JSON.stringify(normalized)));
  } catch (error) {
    state.finish(new Error(`Workflow returned invalid JSON: ${errorText(error)}`));
  }
}

export function handleMessage(state: SandboxState, raw: unknown) {
  if (!isRecord(raw) || raw.token !== state.token || typeof raw.kind !== "string") {
    return state.finish(new Error("Workflow sandbox sent an invalid IPC message"));
  }
  if (raw.kind === "phase") return handlePhase(state, raw);
  if (raw.kind === "agent") return handleAgentMessage(state, raw.id, raw.payloadJson);
  if (raw.kind === "result") return handleResult(state, raw);
  if (raw.kind === "error" && typeof raw.error === "string") {
    return state.finish(new Error(raw.error.slice(0, 16 * 1024)));
  }
  state.finish(new Error("Workflow sandbox sent an unknown IPC message"));
}
