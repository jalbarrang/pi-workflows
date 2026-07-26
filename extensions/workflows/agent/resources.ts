import {
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { STRUCTURED_OUTPUT_SYSTEM_INSTRUCTION } from "../presentation/prompt.ts";
import { compact } from "../shared/compact.ts";

export async function createWorkflowResources(
  cwd: string,
  variant: "plain" | "structured",
  projectTrusted: boolean,
  agentDir = getAgentDir(),
) {
  const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
  const loader = new DefaultResourceLoader(
    compact({
      cwd,
      agentDir,
      settingsManager,
      appendSystemPrompt:
        variant === "structured" ? [STRUCTURED_OUTPUT_SYSTEM_INSTRUCTION] : undefined,
    }),
  );
  await loader.reload();
  return { loader, settingsManager };
}
