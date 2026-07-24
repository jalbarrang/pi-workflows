import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ActiveRun, WorkflowStatus } from "../run/types.ts";
import { activityStatus } from "./activity.ts";

export function createIndicator(active: ReadonlyMap<string, ActiveRun>) {
  let ui: ExtensionContext["ui"] | undefined;
  let done = 0;
  let failed = 0;
  const update = () => {
    if (!ui) return;
    if (!active.size && !done && !failed) return ui.setStatus("workflows", undefined);
    ui.setStatus("workflows", activityStatus(ui.theme, { running: active.size, done, failed }));
  };
  return {
    attach(next: ExtensionContext["ui"]) {
      ui = next;
      update();
    },
    settled(status: Exclude<WorkflowStatus, "running">) {
      if (status === "completed") done++;
      else failed++;
    },
    acknowledge() {
      done = 0;
      failed = 0;
      update();
    },
    update,
    clear() {
      ui?.setStatus("workflows", undefined);
      ui = undefined;
    },
  };
}
