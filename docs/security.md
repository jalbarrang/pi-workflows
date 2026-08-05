# Isolation model

Read this before changing anything under `sandbox/` or `agent/`. The workflow-script sandbox and child-agent isolation are separate boundaries.

## Layer 1 — the script never runs in the host

Orchestration source executes in a separate Node process spawned with `--permission`, filesystem read granted only to the worker directory, and a small heap and stack. Standard IO is discarded; the only channel is an IPC pipe. If the runtime cannot enforce `--permission`, the runner **refuses to start** rather than falling back to in-process execution. Do not add a fallback.

The environment handed to the child is the minimum needed to start: the path variable and `NODE_NO_WARNINGS`, plus `SystemRoot`/`TEMP` on Windows only. That tightness is a security property — forwarding the parent environment would hand a script every token in it. `sandbox/child-env.ts` owns it.

## Layer 2 — the child restricts itself further

Before any script runs, the worker deletes process capabilities that could escape or signal (`getBuiltinModule`, `binding`, `dlopen`, `kill`, `send`, and friends). The script is then compiled into a `vm` context with code generation disabled, so `eval` and `new Function` cannot be used to smuggle in new source. The only bindings exposed are the four DSL primitives, frozen.

Two accounting rules catch a class of model authoring bug: a run that finishes with unawaited `agent()` calls, or with calls still in flight, fails loudly instead of silently discarding work.

## Layer 3 — the IPC protocol is authenticated and bounded

Every message carries a per-run random token; a message without it kills the run. Source, arguments, results, and individual agent messages each have byte caps, prompts have a character cap, and the number of agent requests is capped. Duplicate request ids are rejected. A violation is terminal, never a warning — a script that can retry past a bound has no bound.

## Layer 4 — child sessions isolate state and recursion

Each agent call gets a fresh in-memory session with normal built-ins and trust-appropriate project resources. The SDK policy denies recursive orchestration and user-prompting tools.

The policy excludes the exact `workflow` and `subagent` tool names. It also excludes the compatibility `subagent_*` names. A process with `PI_AGENT_LEAF=1` registers no workflow tool or command.

Every tool call has an independent timeout, including tools that extensions register later. A timeout becomes an error tool result, and the agent can recover.

## What is not guaranteed

State these facts plainly. Do not imply that child agents run inside the workflow-script sandbox.

- **Child tools run in the host process.** Each child receives pi's default tools in the parent working directory. The extension does not provide read-only mode, write fences, or a shell command policy.
- **Loaded extensions keep their normal authority.** Global and trusted-project extensions can register or replace tools, and pi extensions execute with full system permissions.
- **Node permission mode contains only orchestration source.** It does not contain the in-process child session or a tool that the child calls.

## Changing any of this

Keep the script sandbox fail-closed. Preserve authenticated IPC, byte limits, call budgets, capability stripping, and the recursive-tool denylist. Add a separate child-agent permission feature only as an explicit public contract with tests and documentation.
