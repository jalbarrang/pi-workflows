"use strict";
const vm = require("node:vm");
const BOOTSTRAP = require("./child-api.cjs");
const INVOKE = require("./child-invoke.cjs");

module.exports = function run(source, argsJson, callHost, previousJson) {
  const sandbox = Object.create(null);
  sandbox.__argsJson = argsJson;
  sandbox.__hostBridge = callHost;
  if (typeof previousJson === "string") sandbox.__previousJson = previousJson;
  const context = vm.createContext(sandbox, {
    name: "pi-workflow",
    codeGeneration: { strings: false, wasm: false },
  });
  new vm.Script(BOOTSTRAP, { filename: "workflow-bootstrap.js" }).runInContext(context, {
    timeout: 1_000,
  });
  const workflow = vm.compileFunction(
    `"use strict";\nreturn (async function workflow() {\n${source}\n})();`,
    ["agent", "parallel", "phase", "args", "previous"],
    { filename: "workflow-script.js", parsingContext: context },
  );
  context.__workflowBody = workflow;
  new vm.Script(INVOKE, { filename: "workflow-invoke.js" }).runInContext(context, {
    timeout: 1_000,
  });
  return context.__workflowPromise;
};
