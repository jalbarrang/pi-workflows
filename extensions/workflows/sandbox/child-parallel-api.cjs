"use strict";

module.exports = String.raw`
async function parallel(items, options = {}) {
  if (!Array.isArray(items)) {
    throw new Error("parallel() expects an array of zero-argument agent thunks");
  }
  const requested =
    options && typeof options.concurrency === "number" ? Math.floor(options.concurrency) : 4;
  if (!Number.isFinite(requested) || requested < 1) {
    throw new Error("parallel(): concurrency must be a positive integer");
  }
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        return;
      }
      if (typeof items[index] !== "function") {
        throw new Error("parallel() items must be zero-argument functions");
      }
      results[index] = await items[index]();
    }
  };
  const count = Math.min(4, requested, items.length);
  await Promise.all(Array.from({ length: count }, worker));
  return results;
}
`;
