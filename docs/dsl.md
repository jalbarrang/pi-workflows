# The workflow DSL

## Contract

A script is the body of an async function. It receives five globals and returns a JSON-serializable value. It cannot import, evaluate, reach the filesystem or network, or start a process — see [security.md](security.md). The workflow tool always waits for the run and displays live progress in the invoking pi session.

| Primitive                    | Contract                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase(title)`               | Marks the current phase for progress display. An undeclared title is appended to the phase list.                                                                  |
| `agent(prompt, options?)`    | Runs one isolated child agent. Always resolves `{ ok, output, outputFile, outputBytes, outputTruncated?, structured?, structuredFile?, error?, deliveryError? }`. |
| `parallel(thunks, options?)` | Runs zero-argument thunks concurrently, preserving result order.                                                                                                  |
| `args`                       | The parsed `args` tool parameter, or `undefined`. Frozen.                                                                                                         |
| `previous`                   | The value returned by the run named in `resume`, or `undefined`. Frozen.                                                                                          |

Never interpolate one agent's output into the next agent's prompt — that is what overflows the prompt limit. Every result carries `outputFile`, an absolute path to the full answer on disk; pass the path and tell the next agent to read it. See [agent-output.md](agent-output.md).

`export const meta = { name, description, phases }` is optional and is read statically — never evaluated. It is removed from the executable source with line numbers preserved, so runtime stack lines still match what the model wrote.

## `agent()` never throws

Every failure mode resolves as `{ ok: false, error }`: an invalid option, an unknown model, a provider error, an abort, a missing structured result, even an internal fault. Scripts therefore branch on `ok` instead of using `try`/`catch`, which keeps model-authored code simple. This is a hard contract — do not introduce a rejection path. The one exception is the _run_: if the script itself throws, or the sandbox protocol is violated, the whole run fails and the tool call throws.

`required: true` does not change this contract. It stops the _run_ — the failure is recorded, the run is aborted, and the sandbox is killed — so the script is never handed a rejection.

## Gates versus fan-out

Not throwing is the right default for fan-out, where one scout dying should not kill a run. It is the wrong default for a gate, where the whole point is that nothing proceeds until the check passes. Both live in the same API, so the author says which one they meant with `required`.

The failure mode this closes is real: in run `wf_e45f788c8902` a review agent's transport died, the script read `(findings && findings.blocking) || []`, and the run returned `blockingCount: 0, fixup: "skipped - no BLOCKING findings"`. Every field was true and the composite claimed a review that never happened. The terse way to consume structured output is also the unsafe way, so the engine now carries the guarantee:

- `required: true` records `requiredFailure` and aborts. `run/required-resolution.ts` owns `gateStatus`, which forces the run to report `failed` — an abort would otherwise read as a cancellation, and a script that raced to its `return` would read as a completion.
- `run/incomplete.ts` computes `incompletePhases` from agent state at settle time: declared, non-skipped phases with no successful agent, excluding phases whose every agent was declared `optional`. It is independent of the script's return value, so a phase that produced nothing cannot be summarized away.

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
- `maxDurationMs` — optional wall-clock deadline for this agent's model loop, bounded above. Expiry aborts only that agent and resolves `ok: false`; a required agent then stops the run through normal gate semantics.
- `required`, `optional` — booleans only, and mutually exclusive. `required` marks the call a gate: any failure, including one before scheduling, aborts the run. `optional` marks it best-effort: it still resolves `{ ok: false }`, but a phase served only by optional agents is never listed in `incompletePhases` and the agent renders as `failed (optional)` rather than `FAILED`. A truthy string would silently arm or disarm either, so non-booleans are rejected, and so is arming both — that is a contradiction, not a precedence question.

## Validation order

`run/agent-options.ts` resolves options in a fixed order and returns on the first failure: model, effort, tool timeout, agent duration, required, optional. Everything runs _before_ `RunController.schedule`, so an invalid call consumes no concurrency permit and no call budget. Unknown keys are rejected even earlier, in `run/agent-call.ts`, straight after the empty-prompt check.

Gate authoring — how to write a check a model cannot talk its way past — lives in [gates.md](gates.md).

## Child agent isolation

Each call creates a fresh in-memory pi session in the parent working directory. The child receives normal trust-aware resources and pi's default tools. The extension excludes recursive orchestration and user-input tools, but it does not restrict filesystem writes or shell commands. The workflow script runs in a separate permission-restricted process; the agent session runs in the host process. See [the upstream sandbox research](research/upstream-workflow-agent-sandbox.md).

## Re-running one phase

There is no resuming a script: the sandbox holds no continuation to restore, and a failed run is re-run rather than restarted mid-flight. What a re-run needs is not a continuation but the _outputs_ of the phases that already succeeded, and those are on disk in `result.json`.

Pass `resume: "wf_…"` and the script receives that run's returned value as the frozen `previous` global. A redo of one failed gate then costs one agent call instead of the whole pipeline:

```js
const work = previous?.work ?? (await agent(implementPrompt, { label: "implement" })).output;
phase("Review");
const review = await agent(reviewPrompt(work), { label: "review", schema: GATE, required: true });
if (!review.ok) return { status: "unreviewed", work, error: review.error };
return { work, findings: review.structured };
```

The returned value has to carry forward what a re-run will need — this is the reason to return an aggregate rather than the last agent's prose. `artifacts/resume.ts` pattern-matches the run id rather than sanitizing it, bounds the file, and validates the JSON, and the load happens before the new run directory exists so an unreadable target leaves nothing half-started. The run records `resumedFrom` for provenance.

## Static preflight

Before a run starts, `scripting/agent-calls.ts` walks the AST and collects statically decidable facts from each `agent()` call. `run/script-preflight.ts` reports blank prompts, explicit unknown keys, and invalid literal option combinations with source locations. It uses the runtime option resolvers, so the static and runtime rules cannot drift.

`scripting/model-refs.ts` collects literal `model` and `provider` pairs, and `run/model-preflight.ts` reports all unknown models. Dynamic values are skipped because a guessed error could block a valid workflow. These checks run before the run creates an artifact or starts an agent. A late option error can otherwise waste the work from all earlier phases.

## Phases

Phases are declarative and may be conditional. A phase declared `{ title, optional: true }` that the run never enters is reported as _skipped_ rather than pending, so a clean run does not show outstanding work that was never going to happen. A non-optional phase with no agents is hidden from the tool result and shown as empty in the dashboard, matching the original behavior.

At settle time every declared, non-skipped phase with no successful agent is listed in `incompletePhases`, which reaches the tool result, `workflow.json`, and the saved report. Unphased agents are excluded: their failure is already visible in the agent list. So is a phase whose every agent was `optional: true`, because a field that fires on intended outcomes stops being read. The two markers cover different holes: `optional` on a _phase_ says the phase may never be entered, which is all a conditional `if (blocking.length > 0) await agent(...)` needs; `optional` on an _agent_ says the phase was entered and the work was speculative — a second opinion, an alternate implementer tried before a fallback, a nice-to-have doc pass. A call that fails option validation is never best-effort: a misconfiguration is a real fault and still counts as a hole.

## Budgets

Call count, concurrency, timeouts, and preview length are owned by `run/limits.ts`; IPC and payload bounds by `sandbox/limits.ts`. Read them there rather than trusting a number quoted in prose. Note that the _useful_ concurrency for agents running compilers is lower than the policy ceiling, because those agents contend for CPU — that is a caller decision passed to `parallel()`, not something the runtime tunes.
