import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { preflightModels } from "../run/model-preflight.ts";
import { collectModelRefs } from "../scripting/model-refs.ts";

const known = { id: "claude-opus-5", provider: "anthropic", contextWindow: 200_000 };

function context() {
  const registry = {
    find: (provider: string, id: string) =>
      provider === "anthropic" && id === known.id ? known : undefined,
    getAll: () => [known],
  };
  return {
    model: known as ExtensionContext["model"],
    modelRegistry: registry as unknown as ExtensionContext["modelRegistry"],
  };
}

test("static models are collected from nested calls and parallel thunks", () => {
  const refs = collectModelRefs(`
    phase("Scan");
    const scans = await parallel(files.map((file) => () =>
      agent("review " + file, { label: file, model: "anthropic/claude-opus-5" })));
    if (scans.length) {
      await agent("report", { model: "gpt-5.6-terra", provider: "openai" });
    }
  `);
  assert.deepEqual(refs, [
    { model: "anthropic/claude-opus-5" },
    { model: "gpt-5.6-terra", provider: "openai" },
  ]);
});

test("dynamic and computed model expressions are skipped", () => {
  const refs = collectModelRefs(`
    const chosen = args.model;
    await agent("a", { model: chosen });
    await agent("b", { model: \`gpt-\${args.version}\` });
    await agent("c", { ["mo" + "del"]: "openai/gpt-5.6-terra" });
    await agent("d", {});
    await agent("e");
  `);
  assert.deepEqual(refs, []);
});

test("unknown models are reported once, before the run starts", () => {
  const error = preflightModels(
    `await agent("a", { model: "anthropic/claude-fable-5" });
     await agent("b", { model: "anthropic/claude-fable-5" });
     await agent("c", { model: "ghost", provider: "openai" });`,
    context(),
  );
  assert.match(error ?? "", /^Workflow references unknown models: /);
  assert.match(error ?? "", /"anthropic\/claude-fable-5", "openai\/ghost"/);
  assert.ok(
    (error ?? "").indexOf("claude-fable-5") < (error ?? "").indexOf("ghost"),
    "offenders should be listed in source order",
  );
  assert.equal(error?.match(/claude-fable-5/g)?.length, 1);
});

test("known models and dynamic models pass preflight", () => {
  assert.equal(
    preflightModels(`await agent("a", { model: "anthropic/claude-opus-5" });`, context()),
    undefined,
  );
  assert.equal(preflightModels(`await agent("a", { model: args.model });`, context()), undefined);
  assert.equal(preflightModels(`await agent("a");`, context()), undefined);
});

test("unparseable source defers to the parser instead of reporting models", () => {
  assert.equal(preflightModels(`await agent("a", { model: `, context()), undefined);
});
