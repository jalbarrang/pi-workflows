# Architecture

## Shape of the system

One pi tool (`workflow`) and one command (`/workflows`). The tool accepts a JavaScript orchestration script written by the model, runs it inside a permission-restricted Node child, and services the callbacks that child makes. Each `agent()` callback becomes a fresh in-process pi session with normal trust-aware resources and default tools. The extension excludes recursive orchestration and user-input tools, but does not restrict writes or shell commands. Nothing about the script is trusted: it is parsed statically, stripped of its metadata declaration, and executed only inside the child.

## Bounded contexts

Each directory under `extensions/workflows/` is a context with a small public surface, re-exported from its own `index.ts` where one exists.

| Context         | Responsibility                                                                                                                      | Depends on                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `scripting/`    | Parse the script, extract static metadata, and collect statically decidable agent call facts. Pure — no IO, no processes.           | acorn                          |
| `sandbox/`      | Spawn and supervise the child, enforce the IPC protocol and its bounds, own the DSL option-key registry, host the `.cjs` worker.    | `artifacts/` for serialization |
| `agent/`        | Create child sessions, exclude recursive tools, inject structured output, arm the watchdog, guard tool calls, and project outcomes. | `artifacts/`, `run/` types     |
| `run/`          | The run aggregate and its lifecycle: option resolution, scheduling, budget, abort, settle, progress emission.                       | all of the above               |
| `artifacts/`    | Bounded serialization, atomic writes, throttled checkpoints.                                                                        | none                           |
| `presentation/` | Model-facing prompt text, tool renderers, the `/workflows` dashboard, the footer indicator.                                         | `run/` types                   |

`extensions/workflows/index.ts` is the composition root and stays thin: it registers the tool and command, builds the service layer, and wires hooks. Business logic does not live there.

## Service seams

Two infrastructure seams are Effect services, each a `Context.Service` with a `static layer`:

- `SandboxRunner` (`sandbox/service.ts`) — running a script in the child.
- `ArtifactStore` (`artifacts/service.ts`) — persisting a run.

`run/services.ts` merges them into `WorkflowServicesLayer`. The layer is resolved at a boundary — `run/prepare.ts` for the store and `run/script.ts` for the sandbox. Domain modules never import a layer, which keeps them testable: a test supplies `Layer.succeed(...)` and needs no session, child process, or model.

## Run lifecycle

1. **Tool call** — `run/execute.ts` receives the input and parses the script through `scripting/`. It also parses the stripped body in its executable async-function context. A parse failure throws before anything is created, as does an unreadable `resume` target.
2. **Preflight** — `run/prepare.ts` validates statically decidable agent options and model references. It reports call-site option errors before a run directory, an artifact, or an agent exists.
3. **Setup** — run id, run directory, `script.js` and optional `args.json` written, an initial persist through `ArtifactStore`, then `WorkflowState`, the checkpoint scheduler, a `RunController`, and the progress emitter.
4. **Execution** — `run/settle.ts` calls `run/script.ts`, which asks `SandboxRunner` to spawn the child. The child executes the script and calls back over IPC.
5. **Agent callbacks** — `sandbox/agent-message.ts` validates each request against the protocol bounds and hands it to `run/agent-call.ts`, which creates the agent record, validates options, then schedules through `RunController`.
6. **Agent run** — `agent/runner.ts` creates the child session, arms the first-response watchdog, guards every tool call with a timeout, and projects usage and a bounded transcript as it goes. `agent/outcome.ts` turns the end state into a verdict, separating a work failure from a delivery failure (a transport fault after a recorded `structured_output`).
7. **Outcome projection** — `agent/runner.ts` first hands the untruncated answer to the persister supplied by `run/agent-artifacts.ts`, which writes `agents/<index>-<label>/output.md` and `structured.json` into the run directory; the paths then travel on the outcome. `run/agent-outcome.ts` writes the verdict onto the agent record and, when the call was `required`, records `requiredFailure` and aborts the run.
8. **Settle** — the controller seals, waits a bounded time for in-flight agents, marks any orphan as errored, computes `incompletePhases`, applies `gateStatus`, sets the terminal status, and flushes artifacts synchronously.

Every run stays attached to its invoking tool call. It emits throttled progress into the current session's tool block, observes the tool-call abort signal, and returns its settled result through that call.

## Concurrency and cancellation

`run/controller.ts` owns fanout. An Effect `Semaphore` caps concurrent agents, a `Ref` reserves call budget synchronously so a burst cannot exceed it, and each scheduled task gets an `AbortController` derived from both the run signal and the caller's invocation signal. Cancelling one invocation must not abort the run; aborting the run must stop everything. Settle is bounded so a stuck agent cannot hang teardown.

## Adding a feature

A new DSL option touches four places in order: the key registry in `sandbox/option-keys.ts`, a resolver reached from `run/agent-options.ts`, whatever consumes the resolved value, and the option table in the root `README.md`. Adding a key without a resolver means it is accepted and ignored, which the unknown-key rejection exists to prevent — so add both in the same change.
