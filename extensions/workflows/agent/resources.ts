import {
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { STRUCTURED_OUTPUT_SYSTEM_INSTRUCTION } from "../presentation/prompt.ts";

export async function createWorkflowResources(
  cwd: string,
  variant: "plain" | "structured",
  projectTrusted: boolean,
  agentDir = getAgentDir(),
) {
  const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    ...(variant === "structured"
      ? { appendSystemPrompt: [STRUCTURED_OUTPUT_SYSTEM_INSTRUCTION] }
      : {}),
  });
  await loader.reload();
  return { loader, settingsManager };
}
