import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CommandPolicyShape } from "../policy/index.ts";
import type { createWorkflowPersistence } from "../artifacts/index.ts";
import type { RunController } from "./controller.ts";
import type { WorkflowState } from "./state.ts";

export interface RunRuntime {
  pi: ExtensionAPI;
  context: ExtensionContext;
  controller: RunController;
  state: WorkflowState;
  persistence: ReturnType<typeof createWorkflowPersistence>;
  /** This run's artifact directory. Agent outputs are written under it as they land. */
  runDir: string;
  /** Resolved from the CommandPolicy layer so agent calls stay layer-agnostic. */
  checkCommand: CommandPolicyShape["check"];
  emit(): void;
}
