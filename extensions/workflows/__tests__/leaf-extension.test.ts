import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_LEAF_ENV, AGENT_LEAF_VALUE } from "../agent-leaf.ts";
import workflows from "../index.ts";

function restoreLeafMarker(previous: string | undefined): void {
  if (previous === undefined) delete process.env[AGENT_LEAF_ENV];
  else process.env[AGENT_LEAF_ENV] = previous;
}

test("a leaf process registers no workflow surfaces", () => {
  const previous = process.env[AGENT_LEAF_ENV];
  process.env[AGENT_LEAF_ENV] = AGENT_LEAF_VALUE;
  try {
    const forbiddenPiAccess = new Proxy(
      {},
      {
        get() {
          throw new Error("leaf workflow extension accessed the Pi registration API");
        },
      },
    );
    assert.doesNotThrow(() => workflows(forbiddenPiAccess as never));
  } finally {
    restoreLeafMarker(previous);
  }
});
