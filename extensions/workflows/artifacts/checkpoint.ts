import type { WorkflowDetails } from "../run/types.ts";
import { CHECKPOINT_INTERVAL_MS } from "./limits.ts";
import { persistWorkflowJson } from "./persist.ts";

export function createWorkflowPersistence(
  runDir: string,
  details: WorkflowDetails,
  options: {
    intervalMs?: number;
    persist?: (runDir: string, details: WorkflowDetails) => void;
  } = {},
) {
  const interval = Math.max(0, options.intervalMs ?? CHECKPOINT_INTERVAL_MS);
  const persist = options.persist ?? persistWorkflowJson;
  let lastSaved = Date.now();
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    if (!dirty) return;
    try {
      persist(runDir, details);
      dirty = false;
      lastSaved = Date.now();
    } catch {}
  };
  return {
    checkpoint(options: { immediate?: boolean } = {}) {
      dirty = true;
      if (options.immediate) {
        if (timer) clearTimeout(timer);
        timer = undefined;
        save();
        return;
      }
      if (timer) return;
      const delay = Math.max(0, interval - (Date.now() - lastSaved));
      if (!delay) save();
      else timer = setTimeout(save, delay);
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      persist(runDir, details);
      dirty = false;
      lastSaved = Date.now();
    },
  };
}
