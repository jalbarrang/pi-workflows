import type { AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent";
import type { WorkflowDetails } from "./types.ts";
import { summary } from "./format.ts";
import { PROGRESS_INTERVAL_MS } from "./limits.ts";
import { compactToolDetails } from "./result.ts";

export function createProgressEmitter(
  background: boolean,
  details: () => WorkflowDetails,
  update?: AgentToolUpdateCallback<WorkflowDetails>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  const flush = () => {
    timer = undefined;
    last = Date.now();
    if (background) return;
    const current = details();
    update?.({
      content: [{ type: "text", text: summary(current) }],
      details: compactToolDetails(current),
    });
  };
  return {
    emit() {
      if (timer) return;
      timer = setTimeout(flush, Math.max(0, PROGRESS_INTERVAL_MS - (Date.now() - last)));
    },
    flush() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}
