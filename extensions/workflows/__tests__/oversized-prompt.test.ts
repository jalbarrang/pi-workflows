import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PROMPT_CHARS } from "../sandbox/limits.ts";
import { runSandbox } from "./sandbox-fixture.ts";

/**
 * Regression coverage for run `wf_2cf06cc43747`.
 *
 * Four recon agents finished after 11 minutes. The script then interpolated their
 * output into a synthesis prompt, the prompt exceeded MAX_PROMPT_CHARS, and the
 * host treated that author error as a protocol violation: the sandbox was killed,
 * the script never returned, and all four completed results were lost.
 */
const HUGE = MAX_PROMPT_CHARS + 1;

test("an oversized prompt fails one call and the run still returns its value", async () => {
  const calls: string[] = [];
  const result = await runSandbox(
    `const first = await agent("recon");
     const second = await agent("x".repeat(${HUGE}));
     return { first: first.output, secondOk: second.ok, secondError: second.error };`,
    {
      onAgent: async (prompt) => {
        calls.push(prompt.slice(0, 16));
        return { ok: true, output: "recon complete" };
      },
    },
  );
  const value = result as { first: string; secondOk: boolean; secondError: string };
  assert.equal(value.first, "recon complete");
  assert.equal(value.secondOk, false);
  assert.match(value.secondError, /outputFile/);
  assert.match(value.secondError, new RegExp(`${MAX_PROMPT_CHARS} characters limit`));
  // The rejected call never reached the host, so it cost no agent invocation.
  assert.deepEqual(calls, ["recon"]);
});

test("a rejected oversized call leaves the request budget untouched", async () => {
  let served = 0;
  const result = await runSandbox(
    `let refused = 0;
     for (let i = 0; i < 40; i++) {
       const reply = await agent("y".repeat(${HUGE}));
       if (!reply.ok) refused++;
     }
     const survivor = await agent("still allowed");
     return { refused, survivorOk: survivor.ok };`,
    {
      onAgent: async () => {
        served++;
        return { ok: true, output: "served" };
      },
    },
  );
  // 40 refusals is past MAX_AGENT_REQUESTS: if refusals were charged to the
  // budget, the run would have died instead of serving the final call.
  assert.deepEqual(result, { refused: 40, survivorOk: true });
  assert.equal(served, 1);
});

test("an oversized prompt is refused before the agent result is truncated away", async () => {
  const result = await runSandbox(
    `const reply = await agent("z".repeat(${HUGE}));
     return { ok: reply.ok, output: reply.output };`,
  );
  assert.deepEqual(result, { ok: false, output: "" });
});
