import type { WorkflowMeta } from "./types.ts";

export function emptyMeta(): WorkflowMeta {
  return { phases: [] };
}

export function sanitizeMeta(value: unknown): WorkflowMeta {
  if (!value || typeof value !== "object") return emptyMeta();
  const raw = value as Record<string, unknown>;
  const phases = Array.isArray(raw.phases)
    ? raw.phases.slice(0, 64).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const phase = item as Record<string, unknown>;
        if (typeof phase.title !== "string" || !phase.title.trim()) return [];
        return [
          {
            title: phase.title.slice(0, 160),
            ...(typeof phase.detail === "string" ? { detail: phase.detail.slice(0, 2_000) } : {}),
            // Literal `true` only: fail closed on anything truthy-but-not-boolean.
            ...(phase.optional === true ? { optional: true } : {}),
          },
        ];
      })
    : [];
  return {
    ...(typeof raw.name === "string" ? { name: raw.name.slice(0, 160) } : {}),
    ...(typeof raw.description === "string"
      ? { description: raw.description.slice(0, 2_000) }
      : {}),
    phases,
  };
}
