import { toSerializable } from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";
import { checkAgentRequest } from "./agent-request.ts";
import { byteLength, errorText, sanitizeOptions } from "./helpers.ts";
import { MAX_AGENT_MESSAGE_BYTES, MAX_AGENT_REQUESTS } from "./limits.ts";
import type { SandboxState } from "./state.ts";
import type { SandboxAgentResult } from "./types.ts";

function send(state: SandboxState, id: number, result: SandboxAgentResult) {
  if (state.finished || !state.child.connected) return;
  const normalized = toSerializable(result, {
    maxDepth: 16,
    maxNodes: 10_000,
    maxStringBytes: 128 * 1024,
  });
  let resultJson = JSON.stringify(normalized);
  if (byteLength(resultJson) > MAX_AGENT_MESSAGE_BYTES) {
    resultJson = JSON.stringify(
      compact({
        ok: false,
        output: "",
        error: "Agent result exceeded the workflow IPC output limit",
        outputFile: result.outputFile,
      }),
    );
  }
  state.child.send({ token: state.token, kind: "agentResult", id, resultJson });
}

/**
 * Route one agent request from the sandbox.
 *
 * An author error in a single `agent()` call must not kill the run. Run
 * `wf_2cf06cc43747` lost four completed recon agents because an oversized
 * synthesis prompt was treated as a protocol violation: the sandbox was torn
 * down, the script never reached its `return`, and no result was ever written.
 * Only a request that cannot be attributed to a call is fatal now.
 */
export function handleAgentMessage(state: SandboxState, id: unknown, rawJson: unknown) {
  const checked = checkAgentRequest(id, rawJson);
  if (checked.kind === "fatal") return state.finish(new Error(checked.error));
  if (checked.kind === "reject") {
    // Deliberately charged to neither the request budget nor the id set: nothing
    // ran, and a rejected call must not consume a slot a real agent could use.
    return send(state, checked.id, { ok: false, output: "", error: checked.error });
  }
  const request = checked.request;
  if (state.requestIds.has(request.id) || ++state.requestCount > MAX_AGENT_REQUESTS) {
    return state.finish(new Error("Workflow sandbox exceeded its agent request budget"));
  }
  state.requestIds.add(request.id);
  const controller = new AbortController();
  state.active.set(request.id, controller);
  const sendResult = (result: SandboxAgentResult) => {
    if (!state.active.delete(request.id)) return;
    send(state, request.id, result);
  };
  const sanitized = sanitizeOptions(request.options);
  void state.options
    .onAgent(request.prompt, sanitized.options, controller.signal, sanitized.unknownKeys)
    .then(sendResult)
    .catch((error) => sendResult({ ok: false, output: "", error: errorText(error) }));
}
