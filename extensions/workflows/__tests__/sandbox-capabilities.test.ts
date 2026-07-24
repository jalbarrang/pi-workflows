import assert from "node:assert/strict";
import { test } from "node:test";
import { runSandbox } from "./sandbox-fixture.ts";

test("sandbox exposes only workflow capabilities and validates results", async () => {
  const phases: string[] = [];
  const result = await runSandbox(
    `
      phase("Gather");
      const replies = await parallel([
        () => agent("one"),
        () => agent("two"),
      ], { concurrency: 99 });
      return {
        replies: replies.map((reply) => reply.output),
        processType: typeof process,
        requireType: typeof require,
        fetchType: typeof fetch,
      };
    `,
    { onPhase: (title) => phases.push(title) },
  );
  assert.deepEqual(result, {
    replies: ["reply:one", "reply:two"],
    processType: "undefined",
    requireType: "undefined",
    fetchType: "undefined",
  });
  assert.deepEqual(phases, ["Gather"]);
});
test("sandbox result serialization handles cycles and bigint", async () => {
  const result = await runSandbox(`
    const value = { count: 7n };
    value.self = value;
    return value;
  `);
  assert.deepEqual(result, { count: "7n", self: "[circular]" });
});
test("sandbox result serialization resists workflow global poisoning", async () => {
  const result = await runSandbox(`
    JSON.stringify = () => undefined;
    return { preserved: true };
  `);
  assert.deepEqual(result, { preserved: true });
});

test("sandbox rejects unawaited agent calls", async () => {
  let calls = 0;
  await assert.rejects(
    runSandbox(`agent("orphan"); return "done";`, {
      onAgent: async () => {
        calls++;
        return { ok: true, output: "unexpected" };
      },
    }),
    /unawaited agent/,
  );
  assert.equal(calls, 0);
});
test("sandbox source cannot escape the host accounting wrapper", async () => {
  let calls = 0;
  await assert.rejects(
    runSandbox(`}), agent("orphan"), Promise.resolve("bypass"); (async function () {`, {
      onAgent: async () => {
        calls++;
        return { ok: true, output: "unexpected" };
      },
    }),
    /unawaited agent/,
  );
  assert.equal(calls, 0);
});
