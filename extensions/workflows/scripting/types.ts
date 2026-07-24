export interface WorkflowPhase {
  title: string;
  detail?: string;
  /**
   * Declared up front but conditional at runtime. Progress UI reports it as
   * skipped instead of pending when the run ends without entering it.
   */
  optional?: boolean;
}

export interface WorkflowMeta {
  name?: string;
  description?: string;
  phases: WorkflowPhase[];
}

export interface PreparedWorkflowScript {
  source: string;
  meta: WorkflowMeta;
}
