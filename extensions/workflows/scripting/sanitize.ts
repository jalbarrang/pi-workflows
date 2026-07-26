import { compact } from "../shared/compact.ts";
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
          compact({
            title: phase.title.slice(0, 160),
            detail: typeof phase.detail === "string" ? phase.detail.slice(0, 2_000) : undefined,
            // Literal `true` only: fail closed on anything truthy-but-not-boolean.
            optional: phase.optional === true ? true : undefined,
          }),
        ];
      })
    : [];
  return compact({
    name: typeof raw.name === "string" ? raw.name.slice(0, 160) : undefined,
    description: typeof raw.description === "string" ? raw.description.slice(0, 2_000) : undefined,
    phases,
  });
}
