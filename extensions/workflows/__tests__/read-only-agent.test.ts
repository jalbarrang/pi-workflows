import assert from "node:assert/strict";
import { test } from "node:test";
import { createPolicyBashTool } from "../agent/policy-bash.ts";
import { childToolPolicy, READ_ONLY_EXCLUDED_TOOL_NAMES } from "../agent/policy.ts";
import { checkCommand } from "../policy/index.ts";
import { resolveAgentOptions } from "../run/agent-options.ts";
import { TOOL_TIMEOUT_MS } from "../run/limits.ts";

const context = { model: undefined, modelRegistry: { find: () => undefined, getAll: () => [] } };
const resolve = (options: Record<string, unknown>) =>
  resolveAgentOptions(options, context as never, "high");

test("read-only excludes write and edit but never excludes bash", () => {
  // Widened to string[]: the literal union type already makes "bash" unreachable,
  // but the runtime assertion documents why excluding it would break the override.
  const readOnly: readonly string[] = childToolPolicy(true).excludeTools;
  for (const name of READ_ONLY_EXCLUDED_TOOL_NAMES) assert.ok(readOnly.includes(name));
  // Excluding bash would filter out the policy override along with the built-in.
  assert.equal(readOnly.includes("bash"), false);
});

test("the default tool policy is unchanged by the read-only feature", () => {
  const base = childToolPolicy().excludeTools;
  assert.deepEqual(base, [
    "subagent",
    "subagent_spawn",
    "subagent_wait",
    "subagent_cancel",
    "subagent_check",
    "subagent_list",
    "workflow",
    "ask_user",
  ]);
});

test("the policy bash tool registers under the built-in name so it overrides", () => {
  const tool = createPolicyBashTool(process.cwd(), checkCommand);
  assert.equal(tool.name, "bash");
});

test("a denied command throws the policy reason instead of executing", async () => {
  const tool = createPolicyBashTool(process.cwd(), checkCommand);
  await assert.rejects(
    () => tool.execute("call-1", { command: "rm -rf /" }, undefined, undefined, undefined as never),
    /not permitted for a governed workflow agent/,
  );
});

test("a denial tells the agent to account for it rather than work around it", async () => {
  const tool = createPolicyBashTool(process.cwd(), checkCommand);
  await assert.rejects(
    () =>
      tool.execute(
        "call-2",
        { command: "find . | while read f; do wc -l $f; done" },
        undefined,
        undefined,
        undefined as never,
      ),
    /shell control flow[\s\S]*state in your final answer that this command was denied/i,
  );
});

test("tools and allowCommands are validated together", () => {
  assert.match(resolve({ tools: "write" }).error ?? "", /invalid tools "write" \(use read-only\)/);
  assert.match(
    resolve({ allowCommands: ["npm *"] }).error ?? "",
    /requires exactly one of `tools: "read-only"` or `writeScope` \(they are mutually exclusive\)/,
  );
  assert.match(
    resolve({ tools: "read-only", allowCommands: [] }).error ?? "",
    /non-empty array of command patterns/,
  );
  assert.match(
    resolve({ tools: "read-only", allowCommands: [42] }).error ?? "",
    /non-empty array of command patterns/,
  );
});

test("a valid read-only call resolves with trimmed patterns and inherited defaults", () => {
  const { resolved, error } = resolve({
    tools: "read-only",
    allowCommands: ["  npm run *  ", "dotnet *"],
  });
  assert.equal(error, undefined);
  assert.deepEqual(resolved?.allowCommands, ["npm run *", "dotnet *"]);
  assert.equal(resolved?.readOnly, true);
  assert.equal(resolved?.thinkingLevel, "high");
  assert.equal(resolved?.toolCallTimeoutMs, TOOL_TIMEOUT_MS);
});

test("an unscoped call stays unrestricted", () => {
  const { resolved } = resolve({});
  assert.equal(resolved?.readOnly, false);
  assert.equal(resolved?.allowCommands, undefined);
});
