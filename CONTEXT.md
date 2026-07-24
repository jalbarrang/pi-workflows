# Workflow Context

- **Workflow script**: untrusted orchestration authored by the model through the workflow DSL.
- **Meta**: declarative workflow name, description, and planned phases; it is data, never executable behavior.
- **Run**: one workflow execution with a stable identifier and terminal status.
- **Agent call**: one isolated agent invocation that resolves a result object instead of throwing into the script.
- **Phase**: a named stage that groups agent calls for progress and review.
- **Sandbox**: the isolation boundary that exposes only workflow DSL capabilities to a script.
- **Artifact**: a bounded, durable record of a run.
- **Transcript**: a bounded projection of an agent conversation, including reasoning and tool activity.
- **Optional phase**: a declared phase a run may legitimately never enter, reported as skipped rather than outstanding.
- **Command policy**: the ruling on whether a governed agent may run a given shell command.
- **Write scope**: the set of paths a scoped agent is permitted to modify.
- **Governed agent**: an agent call whose shell commands and file writes are subject to policy rather than instruction.
