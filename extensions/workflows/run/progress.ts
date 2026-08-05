import type { AgentToolUpdateCallback } from "@earendil-works/pi-coding-agent";
import type { WorkflowDetails } from "./types.ts";
import { summary } from "./format.ts";
import { PROGRESS_INTERVAL_MS } from "./limits.ts";
import { compactToolDetails } from "./result.ts";

export function createProgressEmitter(
  details: () => WorkflowDetails,
  update?: AgentToolUpdateCallback<WorkflowDetails>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  let lastPayload = "";
  const publish = () => {
    timer = undefined;
    last = Date.now();
    if (!update) return;
    const current = details();
    const payload = {
      content: [{ type: "text" as const, text: summary(current) }],
      details: compactToolDetails(current),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPayload) return;
    lastPayload = serialized;
    update(payload);
  };
  return {
    emit() {
      if (timer) return;
      timer = setTimeout(publish, Math.max(0, PROGRESS_INTERVAL_MS - (Date.now() - last)));
    },
    flush() {
      if (timer) clearTimeout(timer);
      publish();
    },
  };
}
