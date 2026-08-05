import { Type } from "typebox";
import { WORKFLOW_PARAMETER_DESCRIPTIONS } from "./presentation/prompt.ts";

export const WorkflowParameters = Type.Object(
  {
    script: Type.String({ description: WORKFLOW_PARAMETER_DESCRIPTIONS.script }),
    args: Type.Optional(Type.String({ description: WORKFLOW_PARAMETER_DESCRIPTIONS.args })),
    resume: Type.Optional(Type.String({ description: WORKFLOW_PARAMETER_DESCRIPTIONS.resume })),
  },
  { additionalProperties: false },
);
