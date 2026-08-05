import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { createWorkflowSession } from "../agent/create-session.ts";
import { createWorkflowResources } from "../agent/resources.ts";
import { shutdownChildSession } from "../agent/shutdown.ts";

const extensionSource = `
  const tool = (name) => ({
    name,
    label: name,
    description: "fixture",
    parameters: { type: "object", properties: {} },
    async execute() { return { content: [{ type: "text", text: "ok" }] }; }
  });
  export default function (pi) {
    pi.registerTool(tool("subagent"));
    pi.registerTool(tool("workflow"));
    pi.registerTool(tool("leaf_fixture"));
  }
`;

test("workflow children preserve default tools and remove recursive orchestration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-workflow-leaf-tools-"));
  let session;
  try {
    const cwd = path.join(directory, "project");
    const agentDir = path.join(directory, "agent");
    await mkdir(cwd, { recursive: true });
    await mkdir(path.join(agentDir, "extensions"), { recursive: true });
    await writeFile(path.join(agentDir, "extensions", "fixture.ts"), extensionSource);
    const resources = await createWorkflowResources(cwd, "plain", false, agentDir);
    ({ session } = await createWorkflowSession({
      prompt: "fixture",
      cwd,
      loader: resources.loader,
      settingsManager: resources.settingsManager,
      modelRegistry: {} as never,
    }));
    const names = session.getAllTools().map((tool) => tool.name);
    assert.equal(names.includes("subagent"), false);
    assert.equal(names.includes("workflow"), false);
    for (const name of ["read", "bash", "edit", "write", "leaf_fixture"]) {
      assert.equal(names.includes(name), true, `missing child tool: ${name}`);
    }
  } finally {
    if (session) await shutdownChildSession(session);
    await rm(directory, { recursive: true, force: true });
  }
});
