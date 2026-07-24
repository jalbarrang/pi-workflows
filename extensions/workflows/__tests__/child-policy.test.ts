import assert from "node:assert/strict";
import { test } from "node:test";
import { CHILD_EXCLUDED_TOOL_NAMES, childToolPolicy } from "../agent/policy.ts";

test("workflow children deny recursive orchestration and user input tools", () => {
  assert.deepEqual(
    [...CHILD_EXCLUDED_TOOL_NAMES],
    [
      "subagent_spawn",
      "subagent_wait",
      "subagent_cancel",
      "subagent_check",
      "subagent_list",
      "workflow",
      "ask_user",
    ],
  );
  assert.deepEqual(childToolPolicy(), { excludeTools: [...CHILD_EXCLUDED_TOOL_NAMES] });
});
