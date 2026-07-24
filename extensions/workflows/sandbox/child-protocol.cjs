"use strict";
const run = require("./child-vm.cjs");

module.exports = function start(sendIpc) {
  let initialized = false;
  let token;
  const pendingAgents = new Map();
  const send = (message) => sendIpc?.({ token, ...message });
  const fail = (error) => {
    const text = error instanceof Error ? error.message : String(error);
    send({ kind: "error", error: text.slice(0, 16 * 1024) });
  };
  const callHost = (kind, payloadJson) => {
    if (kind === "phase") {
      send({ kind: "phase", payloadJson });
      return undefined;
    }
    if (kind !== "agent") return Promise.reject(new Error("Unknown workflow operation"));
    let id;
    try {
      id = JSON.parse(payloadJson).id;
    } catch {
      return Promise.reject(new Error("Invalid agent request"));
    }
    return new Promise((resolve, reject) => {
      pendingAgents.set(id, { resolve, reject });
      send({ kind: "agent", payloadJson });
    });
  };
  process.on("message", (message) => {
    if (!message || typeof message !== "object") return;
    if (!initialized) {
      const valid =
        message.kind === "init" &&
        typeof message.token === "string" &&
        typeof message.source === "string" &&
        typeof message.argsJson === "string";
      if (!valid) {
        process.exitCode = 1;
        return;
      }
      initialized = true;
      token = message.token;
      try {
        Promise.resolve(run(message.source, message.argsJson, callHost))
          .then((resultJson) => {
            if (typeof resultJson !== "string") {
              throw new Error("Workflow result was not serializable");
            }
            send({ kind: "result", resultJson });
          })
          .catch(fail);
      } catch (error) {
        fail(error);
      }
      return;
    }
    if (message.token !== token || message.kind !== "agentResult") return;
    const pending = pendingAgents.get(message.id);
    if (!pending) return;
    pendingAgents.delete(message.id);
    if (typeof message.resultJson === "string") pending.resolve(message.resultJson);
    else
      pending.reject(
        new Error(typeof message.error === "string" ? message.error : "Agent IPC failed"),
      );
  });
};
