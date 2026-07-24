# The workflow DSL

## Contract

A script is the body of an async function. It receives four globals and returns a JSON-serializable value. It cannot import, evaluate, reach the filesystem or network, or start a process — see [security.md](security.md).

| Primitive                    | Contract                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `phase(title)`               | Marks the current phase for progress display. An undeclared title is appended to the phase list.      |
| `agent(prompt, options?)`    | Runs one isolated child agent. Always resolves `{ ok, output, structured?, error?, deliveryError? }`. |
| `parallel(thunks, options?)` | Runs zero-argument thunks concurrently, preserving result order.                                      |
| `args`                       | The parsed `args` tool parameter, or `undefined`. Frozen.                                             |

`export const meta = { name, description, phases }` is optional and is read statically — never evaluated. It is removed from the executable source with line numbers preserved, so runtime stack lines still match what the model wrote.

## `agent()` never throws

Every failure mode resolves as `{ ok: false, error }`: an invalid option, an unknown model, a provider error, an abort, a missing structured result, even an internal fault. Scripts therefore branch on `ok` instead of using `try`/`catch`, which keeps model-authored code simple. This is a hard contract — do not introduce a rejection path.

The one exception is the _run_: if the script itself throws, or the sandbox protocol is violated, the whole run fails and the tool call throws.

`required: true` does not change this contract. It stops the _run_ — the failure is recorded, the run is aborted, and the sandbox is killed — so the script is never handed a rejection.

## Gates versus fan-out

Not throwing is the right default for fan-out, where one scout dying should not kill a run. It is the wrong default for a gate, where the whole point is that nothing proceeds until the check passes. Both live in the same API, so the author says which one they meant with `required`.

The failure mode this closes is real: in run `wf_e45f788c8902` a review agent's transport died, the script read `(findings && findings.blocking) || []`, and the run returned `blockingCount: 0, fixup: "skipped - no BLOCKING findings"`. Every field was true and the composite claimed a review that never happened. The terse way to consume structured output is also the unsafe way, so the engine now carries the guarantee:

- `required: true` records `requiredFailure` and aborts. `run/required-resolution.ts` owns `gateStatus`, which forces the run to report `failed` — an abort would otherwise read as a cancellation, and a script that raced to its `return` would read as a completion.
- `run/incomplete.ts` computes `incompletePhases` from agent state at settle time: declared, non-skipped phases with no successful agent. It is independent of the script's return value, so a phase that produced nothing cannot be summarized away.

## Work failure versus delivery failure

`agent/outcome.ts` classifies how a child session ended, and it separates the two. A schema-bearing agent that has called the terminating `structured_output` tool has finished: the payload is validated and already in the transcript. A transport error after that point is a delivery failure, so the verdict stays `ok: true` and carries `deliveryError`.

This is not leniency. In `wf_e45f788c8902` the discarded review had run to completion (12 turns, 57k of a 272k context, $0.49) and its single finding was reproduced exactly by the paid re-run. An abort is still fatal regardless of what was recorded: cancellation is intentional, and a script should not silently trust a partial result from an agent someone stopped.

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
- `required` — booleans only. Marks the call a gate: any failure, including one that happens before scheduling, aborts the run. A truthy string would silently arm or disarm a gate, so it is rejected.

## Validation order

`run/agent-options.ts` resolves options in a fixed order and returns on the first failure: model, effort, tool timeout, tool mode, write scope, allowed commands, required. Everything runs _before_ `RunController.schedule`, so an invalid call consumes no concurrency permit and no call budget. Unknown keys are rejected even earlier, in `run/agent-call.ts`, straight after the empty-prompt check.

Two rejections exist purely to stop an option from being inert:

- `allowCommands` without `tools: "read-only"` or `writeScope` — bash would be unrestricted, so the patterns would do nothing.
- `writeScope` together with `tools: "read-only"` — read-only removes `write`/`edit`, so there is nothing left to fence.

## Static preflight

Before a run starts, `scripting/model-refs.ts` walks the AST for `agent()` calls and collects `model`/`provider` pairs that are string literals. `run/model-preflight.ts` checks each against the registry and reports every offender at once. A dynamic or computed model expression is skipped — a false "unknown model" would block a valid workflow, so the check is deliberately best-effort in one direction only.

This exists because a model typo, or a model removed from `models.json` between runs, otherwise surfaces when its phase executes — potentially after many minutes of successful work.

## Phases

Phases are declarative and may be conditional. A phase declared `{ title, optional: true }` that the run never enters is reported as _skipped_ rather than pending, so a clean run does not show outstanding work that was never going to happen. A non-optional phase with no agents is hidden from the tool result and shown as empty in the dashboard, matching the original behavior.

At settle time every declared, non-skipped phase with no successful agent is listed in `incompletePhases`, which reaches the tool result, `workflow.json`, and the saved report. Unphased agents are excluded: their failure is already visible in the agent list.

## Budgets

Call count, concurrency, timeouts, and preview length are owned by `run/limits.ts`; IPC and payload bounds by `sandbox/limits.ts`. Read them there rather than trusting a number quoted in prose. Note that the _useful_ concurrency for agents running compilers is lower than the policy ceiling, because those agents contend for CPU — that is a caller decision passed to `parallel()`, not something the runtime tunes.
