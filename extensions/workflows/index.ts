import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeWorkflow } from "./run/execute.ts";
import { WorkflowServicesLayer } from "./run/services.ts";
import type { ActiveRun } from "./run/types.ts";
import { registerLifecycle } from "./lifecycle.ts";
import { registerWorkflowCommand } from "./presentation/command.ts";
import { createIndicator } from "./presentation/indicator.ts";
import {
  WORKFLOW_PROMPT_GUIDELINES,
  WORKFLOW_PROMPT_SNIPPET,
  WORKFLOW_TOOL_DESCRIPTION,
} from "./presentation/prompt.ts";
import { renderWorkflowCall } from "./presentation/render-call.ts";
import { renderWorkflowResult } from "./presentation/render-result.ts";
import { WorkflowParameters } from "./tool.ts";
import { isAgentLeafEnvironment } from "./agent-leaf.ts";

export default function workflows(pi: ExtensionAPI) {
  if (isAgentLeafEnvironment()) return;

  const active = new Map<string, ActiveRun>();
  const indicator = createIndicator(active);
  registerLifecycle(pi, active, indicator.attach, indicator.clear);
  registerWorkflowCommand(pi, active, indicator.acknowledge);
  pi.registerTool({
    name: "workflow",
    label: "Workflow",
    description: WORKFLOW_TOOL_DESCRIPTION,
    promptSnippet: WORKFLOW_PROMPT_SNIPPET,
    promptGuidelines: WORKFLOW_PROMPT_GUIDELINES,
    parameters: WorkflowParameters,
    execute: (_id, input, signal, update, context) =>
      executeWorkflow(
        pi,
        input,
        signal ?? new AbortController().signal,
        update,
        context,
        active,
        WorkflowServicesLayer,
        { settled: indicator.settled, changed: indicator.update },
      ),
    renderCall: (input, theme, renderContext) =>
      renderWorkflowCall(input, theme, renderContext.lastComponent, renderContext.argsComplete),
    renderResult: (result, options, theme, renderContext) =>
      renderWorkflowResult(result, options.expanded, theme, renderContext.lastComponent),
  });
}
