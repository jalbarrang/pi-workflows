import assert from "node:assert/strict";
import { test } from "node:test";
import { WORKFLOW_PROMPT_SNIPPET, WORKFLOW_TOOL_DESCRIPTION } from "../presentation/prompt.ts";
import { AGENT_OPTION_KEYS } from "../sandbox/index.ts";
import { WorkflowParameters } from "../tool.ts";

test("workflow agents expose upstream-style options without permission modes", () => {
  assert.deepEqual(AGENT_OPTION_KEYS, [
    "label",
    "phase",
    "schema",
    "model",
    "provider",
    "effort",
    "toolTimeoutMs",
    "maxDurationMs",
    "required",
    "optional",
  ]);
  assert.doesNotMatch(WORKFLOW_TOOL_DESCRIPTION, /read-only|writeScope|allowCommands|governed/);
});

test("workflow public contract exposes only foreground execution", () => {
  assert.deepEqual(Object.keys(WorkflowParameters.properties), ["script", "args", "resume"]);
  assert.equal(Reflect.get(WorkflowParameters, "additionalProperties"), false);
  assert.doesNotMatch(`${WORKFLOW_TOOL_DESCRIPTION}\n${WORKFLOW_PROMPT_SNIPPET}`, /background/i);
});
