"use strict";
const sendIpc = typeof process.send === "function" ? process.send.bind(process) : undefined;
for (const capability of [
  "getBuiltinModule",
  "binding",
  "_linkedBinding",
  "dlopen",
  "kill",
  "abort",
  "send",
]) {
  try {
    Object.defineProperty(process, capability, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {}
}
require("./child-protocol.cjs")(sendIpc);
