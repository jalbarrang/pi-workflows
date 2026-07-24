import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { createWorkflowResources } from "../agent/index.ts";

const extensionSource = (name: string) => `
  export default function (pi) {
    pi.registerTool({
      name: ${JSON.stringify(name)},
      label: ${JSON.stringify(name)},
      description: "fixture",
      parameters: { type: "object", properties: {} },
      async execute() { return { content: [{ type: "text", text: "ok" }] }; }
    });
  }
`;

async function toolNames(cwd: string, agentDir: string, trusted: boolean) {
  const resources = await createWorkflowResources(cwd, "plain", trusted, agentDir);
  return resources.loader
    .getExtensions()
    .extensions.flatMap((extension) => [...extension.tools.keys()]);
}

test("workflow resources gate project extensions but retain global extensions", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-workflow-trust-"));
  try {
    const cwd = path.join(directory, "project");
    const agentDir = path.join(directory, "agent");
    await mkdir(path.join(cwd, ".pi", "extensions"), { recursive: true });
    await mkdir(path.join(agentDir, "extensions"), { recursive: true });
    await writeFile(
      path.join(agentDir, "extensions", "global.ts"),
      extensionSource("global_fixture"),
    );
    await writeFile(
      path.join(cwd, ".pi", "extensions", "project.ts"),
      extensionSource("project_fixture"),
    );
    const untrusted = await toolNames(cwd, agentDir, false);
    assert.equal(untrusted.includes("global_fixture"), true);
    assert.equal(untrusted.includes("project_fixture"), false);
    const trusted = await toolNames(cwd, agentDir, true);
    assert.equal(trusted.includes("global_fixture"), true);
    assert.equal(trusted.includes("project_fixture"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
