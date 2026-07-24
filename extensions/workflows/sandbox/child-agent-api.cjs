"use strict";

module.exports = String.raw`
function deepFreeze(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 32 || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key], depth + 1);
  }
  return value;
}

function requestAgent(promptValue, optionsValue = {}) {
  const id = ++nextRequestId;
  unconsumed.add(id);
  let started;
  const begin = () => {
    unconsumed.delete(id);
    if (started) {
      return started;
    }
    let payload;
    try {
      payload = JSON.stringify({
        id,
        prompt: typeof promptValue === "string" ? promptValue : String(promptValue ?? ""),
        options: optionsValue && typeof optionsValue === "object" ? optionsValue : {},
      });
    } catch (error) {
      started = Promise.reject(
        new Error("agent() arguments must be serializable: " + error.message),
      );
      return started;
    }
    inFlight.add(id);
    started = callHost("agent", payload)
      .then((json) => JSON.parse(json))
      .finally(() => inFlight.delete(id));
    return started;
  };
  return Object.freeze({
    then(resolve, reject) {
      return begin().then(resolve, reject);
    },
    catch(reject) {
      return begin().catch(reject);
    },
    finally(callback) {
      return begin().finally(callback);
    },
    get [Symbol.toStringTag]() {
      return "Promise";
    },
  });
}
`;
