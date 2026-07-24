import { Effect, Ref } from "effect";
import { MAX_AGENT_CALLS } from "./limits.ts";

export function abortError(signal: AbortSignal) {
  return signal.reason instanceof Error ? signal.reason : new Error("Workflow was aborted");
}

export function reserveCall(counter: Ref.Ref<number>) {
  return Effect.runSync(
    Ref.modify(counter, (count) => (count >= MAX_AGENT_CALLS ? [false, count] : [true, count + 1])),
  );
}
