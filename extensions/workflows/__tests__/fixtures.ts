import type { WorkflowDetails } from "../run/types.ts";

export function workflowDetails(): WorkflowDetails {
  return {
    runId: "wf_fixture",
    sessionId: "session_fixture",
    background: false,
    status: "running",
    startedAt: 1,
    phases: [],
    agents: [],
  };
}
