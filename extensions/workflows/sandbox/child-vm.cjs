"use strict";
const vm = require("node:vm");
const BOOTSTRAP = require("./child-api.cjs");
const INVOKE = require("./child-invoke.cjs");

module.exports = function run(source, argsJson, callHost) {
  const sandbox = Object.create(null);
  sandbox.__argsJson = argsJson;
  sandbox.__hostBridge = callHost;
  const context = vm.createContext(sandbox, {
    name: "pi-workflow",
    codeGeneration: { strings: false, wasm: false },
  });
  new vm.Script(BOOTSTRAP, { filename: "workflow-bootstrap.js" }).runInContext(context, {
    timeout: 1_000,
  });
  const workflow = vm.compileFunction(
    `"use strict";\nreturn (async function workflow() {\n${source}\n})();`,
    ["agent", "parallel", "phase", "args"],
    { filename: "workflow-script.js", parsingContext: context },
  );
  context.__workflowBody = workflow;
  new vm.Script(INVOKE, { filename: "workflow-invoke.js" }).runInContext(context, {
    timeout: 1_000,
  });
  return context.__workflowPromise;
};
