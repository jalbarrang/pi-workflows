"use strict";

const AGENT_API = require("./child-agent-api.cjs");
const PARALLEL_API = require("./child-parallel-api.cjs");

module.exports = String.raw`
(function bootstrapWorkflowApi() {
  "use strict";
  const callHost = globalThis.__hostBridge;
  delete globalThis.__hostBridge;
  let nextRequestId = 0;
  const unconsumed = new Set();
  const inFlight = new Set();

  ${AGENT_API}
  ${PARALLEL_API}

  const envelope = JSON.parse(globalThis.__argsJson);
  const args = envelope.defined ? deepFreeze(envelope.value) : undefined;
  delete globalThis.__argsJson;
  const stringify = JSON.stringify;
  function serializeResult(value) {
    const seen = new WeakSet();
    return stringify(value === undefined ? null : value, (_key, item) => {
      if (typeof item === "bigint") {
        return item.toString() + "n";
      }
      if (item && typeof item === "object") {
        if (seen.has(item)) {
          return "[circular]";
        }
        seen.add(item);
      }
      return item;
    });
  }
  const phase = (title) => {
    callHost("phase", JSON.stringify({ title: String(title) }));
  };
  Object.defineProperties(globalThis, {
    agent: { value: requestAgent },
    parallel: { value: parallel },
    phase: { value: phase },
    args: { value: args },
    __workflowCheck: {
      value: Object.freeze(() => ({
        unconsumed: unconsumed.size,
        inFlight: inFlight.size,
      })),
    },
    __workflowSerialize: { value: Object.freeze(serializeResult) },
  });
})();
`;
