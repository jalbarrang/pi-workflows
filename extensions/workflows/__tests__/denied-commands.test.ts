import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChildCustomTools } from "../agent/child-tools.ts";
import { createDeniedCommandLog } from "../agent/denied.ts";
import { createPolicyBashTool } from "../agent/policy-bash.ts";
import type { RunAgentOptions } from "../agent/types.ts";
import { checkCommand } from "../policy/index.ts";
import { buildWorkflowResultMessage } from "../presentation/result-text.ts";
import { workflowDetails } from "./fixtures.ts";

test("a denied command is reported upward as well as to the child agent", async () => {
  const denied: string[] = [];
  const tool = createPolicyBashTool(process.cwd(), checkCommand, {
    onDenied: (command) => denied.push(command),
  });
  await assert.rejects(() =>
    tool.execute("c1", { command: "git commit -m x" }, undefined, undefined, undefined as never),
  );
  await assert.rejects(() =>
    tool.execute("c2", { command: "rm -rf ." }, undefined, undefined, undefined as never),
  );
  assert.deepEqual(denied, ["git commit -m x", "rm -rf ."]);
});

test("an allowed command is not reported as denied", async () => {
  const denied: string[] = [];
  const tool = createPolicyBashTool(process.cwd(), checkCommand, {
    onDenied: (command) => denied.push(command),
  });
  await tool.execute("c1", { command: "echo policy-ok" }, undefined, undefined, undefined as never);
  assert.deepEqual(denied, []);
});

test("the denial log deduplicates, trims, and stays bounded", () => {
  const log = createDeniedCommandLog();
  log.record("git mv a b");
  log.record("  git mv a b  ");
  log.record("");
  for (let index = 0; index < 40; index++) log.record(`cmd-${index}`);
  const list = log.list();
  assert.equal(list[0], "git mv a b");
  assert.equal(list.length, 20);
  assert.equal(list.includes(""), false);
});

test("a governed agent's bash tool carries the denial hook", () => {
  const options = {
    prompt: "p",
    cwd: process.cwd(),
    readOnly: true,
    policyGoverned: true,
    checkCommand,
  } as unknown as RunAgentOptions;
  const tools = buildChildCustomTools(options, { structured: () => {}, denied: () => {} });
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["bash"],
  );
});

test("the tool result lists denied commands so a no-op agent is explicable", () => {
  const details = workflowDetails();
  details.status = "completed";
  details.agents = [
    {
      index: 1,
      label: "extract",
      state: "done",
      startedAt: 1,
      preview: "",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      transcript: [],
      deniedCommands: ["git mv server/a.ts domain/a.ts"],
    },
  ];
  const message = buildWorkflowResultMessage(details, "/tmp/wf");
  assert.match(message, /denied commands: git mv server\/a\.ts domain\/a\.ts/);
});
