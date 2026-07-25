import type { WorkflowDetails } from "../../run/types.ts";
import { normalizeAgent } from "./normalize.ts";

export function normalizeDetails(runId: string, value: unknown): WorkflowDetails | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const meta = (raw.meta ?? {}) as Record<string, unknown>;
  const startedAt = typeof raw.startedAt === "number" ? raw.startedAt : 0;
  const agents = (Array.isArray(raw.agents) ? raw.agents : [])
    .map((agent, index) => normalizeAgent(agent, index, startedAt))
    .filter((agent) => agent !== undefined);
  const sourcePhases = Array.isArray(raw.phases)
    ? raw.phases
    : Array.isArray(meta.phases)
      ? meta.phases
      : [];
  const phases = sourcePhases.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const phase = value as Record<string, unknown>;
    if (typeof phase.title !== "string") return [];
    return [
      {
        title: phase.title,
        ...(typeof phase.detail === "string" ? { detail: phase.detail } : {}),
        ...(phase.optional === true ? { optional: true } : {}),
      },
    ];
  });
  const status = ["running", "failed", "aborted"].includes(String(raw.status))
    ? (raw.status as WorkflowDetails["status"])
    : "completed";
  return {
    runId,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    name:
      typeof raw.name === "string"
        ? raw.name
        : typeof meta.name === "string"
          ? meta.name
          : undefined,
    description:
      typeof raw.description === "string"
        ? raw.description
        : typeof meta.description === "string"
          ? meta.description
          : undefined,
    background: raw.background === true,
    status,
    startedAt,
    finishedAt: typeof raw.finishedAt === "number" ? raw.finishedAt : undefined,
    phases,
    currentPhase: typeof raw.currentPhase === "string" ? raw.currentPhase : undefined,
    agents,
    result: raw.result,
    resultArtifact: typeof raw.resultArtifact === "string" ? raw.resultArtifact : undefined,
    transcriptArtifact:
      typeof raw.transcriptArtifact === "string" ? raw.transcriptArtifact : undefined,
    error: typeof raw.error === "string" ? raw.error : undefined,
    incompletePhases: (Array.isArray(raw.incompletePhases) ? raw.incompletePhases : []).filter(
      (title): title is string => typeof title === "string",
    ),
    resumedFrom: typeof raw.resumedFrom === "string" ? raw.resumedFrom : undefined,
  };
}
