# Workflow Context

- **Workflow script**: untrusted orchestration authored by the model through the workflow DSL.
- **Meta**: declarative workflow name, description, and planned phases; it is data, never executable behavior.
- **Run**: one workflow execution with a stable identifier and terminal status.
- **Agent call**: one isolated agent invocation that resolves a result object instead of throwing into the script.
- **Phase**: a named stage that groups agent calls for progress and review.
- **Sandbox**: the isolation boundary that exposes only workflow DSL capabilities to a script.
- **Artifact**: a bounded, durable record of a run.
- **Resumed run**: a new run handed a previous run's returned value, so phases that already succeeded need not be re-paid for.
- **Transcript**: a bounded projection of an agent conversation, including reasoning and tool activity.
- **Optional phase**: a declared phase a run may legitimately never enter, reported as skipped rather than outstanding.
- **Incomplete phase**: a declared, non-skipped phase that produced no successful agent.
- **Gate**: an agent call whose failure stops the run instead of resolving a failed result.
- **Best-effort call**: an agent call declared speculative, whose failure is not reported as a hole.
- **Delivery failure**: a transport fault that arrives after an agent's result was already recorded; the work stands.
