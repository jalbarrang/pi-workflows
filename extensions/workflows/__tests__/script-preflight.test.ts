import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { preflightWorkflowScript } from "../run/script-preflight.ts";

const known = { id: "gpt-5.6-terra", provider: "openai", contextWindow: 200_000 };

function context() {
  const registry = {
    find: (provider: string, id: string) =>
      provider === known.provider && id === known.id ? known : undefined,
    getAll: () => [known],
  };
  return {
    model: known as ExtensionContext["model"],
    modelRegistry: registry as unknown as ExtensionContext["modelRegistry"],
  };
}

test("static preflight reports all decidable option errors with source locations", () => {
  const error = preflightWorkflowScript(
    `await agent("scan", { effort: "heroic" });
await agent("review", { required: true, optional: true });`,
    context(),
    "high",
  );
  assert.match(error ?? "", /^Workflow script failed static validation:/);
  assert.match(error ?? "", /1:7 invalid effort "heroic"/);
  assert.match(error ?? "", /2:7 optional and required cannot both be true/);
});

test("removed permission options are rejected instead of ignored", () => {
  const error = preflightWorkflowScript(
    `await agent("write", {
  tools: "read-only",
  allowCommands: ["npm test"],
  writeScope: ["src/**"],
});`,
    context(),
    "high",
  );
  assert.match(error ?? "", /unknown agent options "tools", "allowCommands", "writeScope"/);
});

test("option diagnostics and unknown models are aggregated", () => {
  const error = preflightWorkflowScript(
    `await agent("scan", { effort: "heroic" });
await agent("review", { model: "openai/ghost" });`,
    context(),
    "high",
  );
  assert.match(error ?? "", /1:7 invalid effort "heroic"/);
  assert.match(error ?? "", /Workflow references unknown models: "openai\/ghost"/);
});

test("unknown literal keys are linted even when another option is dynamic", () => {
  const error = preflightWorkflowScript(
    `await agent("scan", { label: args.label, thinking: "high" });`,
    context(),
    "high",
  );
  assert.match(error ?? "", /1:7 unknown agent option "thinking"/);
  assert.match(error ?? "", /valid: label\|phase\|schema\|model/);
});

test("dynamic values are deferred while known static calls pass", () => {
  assert.equal(
    preflightWorkflowScript(
      `await agent("scan", { effort: args.effort });
await agent("review", { model: "openai/gpt-5.6-terra", required: true });`,
      context(),
      "high",
    ),
    undefined,
  );
});

test("an omitted or statically blank prompt fails preflight", () => {
  const error = preflightWorkflowScript(`agent(); agent("  ");`, context(), "high");
  assert.match(error ?? "", /1:1 agent\(\) requires a non-empty prompt string/);
  assert.match(error ?? "", /1:10 agent\(\) requires a non-empty prompt string/);
});
