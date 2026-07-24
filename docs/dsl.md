# The workflow DSL

## Contract

A script is the body of an async function. It receives four globals and returns a JSON-serializable value. It cannot import, evaluate, reach the filesystem or network, or start a process — see [security.md](security.md).

| Primitive                    | Contract                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `phase(title)`               | Marks the current phase for progress display. An undeclared title is appended to the phase list. |
| `agent(prompt, options?)`    | Runs one isolated child agent. Always resolves `{ ok, output, structured?, error? }`.            |
| `parallel(thunks, options?)` | Runs zero-argument thunks concurrently, preserving result order.                                 |
| `args`                       | The parsed `args` tool parameter, or `undefined`. Frozen.                                        |

`export const meta = { name, description, phases }` is optional and is read statically — never evaluated. It is removed from the executable source with line numbers preserved, so runtime stack lines still match what the model wrote.

## `agent()` never throws

Every failure mode resolves as `{ ok: false, error }`: an invalid option, an unknown model, a provider error, an abort, a missing structured result, even an internal fault. Scripts therefore branch on `ok` instead of using `try`/`catch`, which keeps model-authored code simple. This is a hard contract — do not introduce a rejection path.

The one exception is the _run_: if the script itself throws, or the sandbox protocol is violated, the whole run fails and the tool call throws.

## Option semantics

The accepted keys are owned by `sandbox/option-keys.ts`. Their runtime meaning:

- `label`, `phase` — naming and grouping for progress display. Truncated, never validated further.
- `schema` — a JSON Schema. Injects a one-shot terminating `structured_output` tool and requires the agent to call it exactly once. Finishing without calling it is a failure, not a silent empty result.
- `model`, `provider` — override the session model. `provider` requires `model`. A bare `model` may be `provider/id` or a plain id resolved across providers.
- `effort` — the thinking level. This is the DSL name for pi's internal `thinkingLevel`.
- `toolTimeoutMs` — per-tool-call timeout for this agent, bounded above. Rejected rather than clamped.
- `tools` — currently only `"read-only"`: removes `write`/`edit` and routes bash through the command policy.
- `allowCommands` — command globs a governed agent may run. `*` matches within one argument; a trailing `*` matches the rest of the command. Only valid when the agent is governed.
- `writeScope` — path globs `write`/`edit` are fenced to. Implies the agent is governed, because a fence bash can write around is not a fence.

## Validation order

`run/agent-options.ts` resolves options in a fixed order and returns on the first failure: model, effort, tool timeout, tool mode, write scope, allowed commands. Everything runs _before_ `RunController.schedule`, so an invalid call consumes no concurrency permit and no call budget. Unknown keys are rejected even earlier, in `run/agent-call.ts`, straight after the empty-prompt check.

Two rejections exist purely to stop an option from being inert:

- `allowCommands` without `tools: "read-only"` or `writeScope` — bash would be unrestricted, so the patterns would do nothing.
- `writeScope` together with `tools: "read-only"` — read-only removes `write`/`edit`, so there is nothing left to fence.

## Static preflight

Before a run starts, `scripting/model-refs.ts` walks the AST for `agent()` calls and collects `model`/`provider` pairs that are string literals. `run/model-preflight.ts` checks each against the registry and reports every offender at once. A dynamic or computed model expression is skipped — a false "unknown model" would block a valid workflow, so the check is deliberately best-effort in one direction only.

This exists because a model typo, or a model removed from `models.json` between runs, otherwise surfaces when its phase executes — potentially after many minutes of successful work.

## Phases

Phases are declarative and may be conditional. A phase declared `{ title, optional: true }` that the run never enters is reported as _skipped_ rather than pending, so a clean run does not show outstanding work that was never going to happen. A non-optional phase with no agents is hidden from the tool result and shown as empty in the dashboard, matching the original behavior.

## Budgets

Call count, concurrency, timeouts, and preview length are owned by `run/limits.ts`; IPC and payload bounds by `sandbox/limits.ts`. Read them there rather than trusting a number quoted in prose. Note that the _useful_ concurrency for agents running compilers is lower than the policy ceiling, because those agents contend for CPU — that is a caller decision passed to `parallel()`, not something the runtime tunes.
