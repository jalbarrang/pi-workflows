import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ActiveRun } from "./run/types.ts";

export function registerLifecycle(
  pi: ExtensionAPI,
  active: ReadonlyMap<string, ActiveRun>,
  onStart: (ui: ExtensionContext["ui"]) => void,
  onStop: () => void,
) {
  pi.on("session_start", (_event, context) => {
    if (context.hasUI) onStart(context.ui);
  });
  pi.on("session_shutdown", async () => {
    const runs = [...active.values()];
    for (const run of runs) run.controller.abort("Session is shutting down");
    await Promise.all(runs.map((run) => run.controller.settle({ abort: true })));
    const completions = runs.flatMap((run) => (run.completion ? [run.completion] : []));
    if (completions.length) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 8_000);
        timer.unref?.();
      });
      await Promise.race([Promise.allSettled(completions), timeout]);
      if (timer) clearTimeout(timer);
    }
    onStop();
  });
}
