import assert from "node:assert/strict";
import { test } from "node:test";
import { shutdownChildSession, type DisposableChildSession } from "../agent/shutdown.ts";

test("child shutdown balances hooks and disposal despite errors", async () => {
  let emits = 0;
  let disposals = 0;
  const session: DisposableChildSession = {
    extensionRunner: {
      hasHandlers: () => true,
      async emit(event) {
        emits++;
        assert.deepEqual(event, { type: "session_shutdown", reason: "quit" });
        throw new Error("fixture shutdown failure");
      },
    },
    dispose() {
      disposals++;
    },
  };
  await Promise.all([
    shutdownChildSession(session),
    shutdownChildSession(session),
    shutdownChildSession(session),
  ]);
  assert.equal(emits, 1);
  assert.equal(disposals, 1);
});

test("child shutdown bounds a stuck hook before disposal", async () => {
  let disposals = 0;
  const session: DisposableChildSession = {
    extensionRunner: {
      hasHandlers: () => true,
      emit: () => new Promise(() => {}),
    },
    dispose() {
      disposals++;
    },
  };
  await shutdownChildSession(session, { timeoutMs: 10 });
  assert.equal(disposals, 1);
});
