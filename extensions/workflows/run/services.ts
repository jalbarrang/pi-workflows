import { Layer } from "effect";
import { ArtifactStore } from "../artifacts/index.ts";
import { SandboxRunner } from "../sandbox/index.ts";

export const WorkflowServicesLayer = Layer.merge(ArtifactStore.layer, SandboxRunner.layer);
