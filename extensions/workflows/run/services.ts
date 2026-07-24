import { Layer } from "effect";
import { ArtifactStore } from "../artifacts/index.ts";
import { CommandPolicy } from "../policy/index.ts";
import { SandboxRunner } from "../sandbox/index.ts";

export const WorkflowServicesLayer = Layer.mergeAll(
  ArtifactStore.layer,
  SandboxRunner.layer,
  CommandPolicy.layer,
);
