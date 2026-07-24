import { Effect, Ref } from "effect";
import type { AgentRecord, WorkflowDetails } from "./types.ts";

export class WorkflowState {
  private readonly ref: Ref.Ref<WorkflowDetails>;
  constructor(details: WorkflowDetails) {
    this.ref = Effect.runSync(Ref.make(details));
  }
  snapshot() {
    return Effect.runSync(Ref.get(this.ref));
  }
  update(change: (details: WorkflowDetails) => void) {
    return Effect.runSync(
      Ref.updateAndGet(this.ref, (details) => {
        change(details);
        return details;
      }),
    );
  }
  addAgent(record: AgentRecord) {
    return this.update((details) => details.agents.push(record));
  }
  nextAgentIndex() {
    return Effect.runSync(
      Ref.modify(this.ref, (details) => {
        const index = details.agents.length + 1;
        return [index, details];
      }),
    );
  }
}
