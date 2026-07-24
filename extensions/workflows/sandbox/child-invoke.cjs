"use strict";
module.exports = String.raw`
(() => {
  const workflowBody = globalThis.__workflowBody;
  delete globalThis.__workflowBody;
  globalThis.__workflowPromise = Promise.resolve(
    workflowBody(agent, parallel, phase, args),
  ).then(async (value) => {
    await Promise.resolve();
    const pending = __workflowCheck();
    if (pending.unconsumed > 0) {
      throw new Error("Workflow created " + pending.unconsumed + " unawaited agent() call(s)");
    }
    if (pending.inFlight > 0) {
      throw new Error("Workflow returned before " + pending.inFlight + " agent call(s) settled");
    }
    return __workflowSerialize(value);
  });
})();
`;
