# @dreki-gg/pi-workflows

Secure multi-agent workflow orchestration for [pi](https://github.com/earendil-works/pi-mono).

## Install

```bash
pi install npm:@dreki-gg/pi-workflows
```

The host must run a Node version that supports `--permission` (Node 22 or newer is recommended). The extension fails closed when permission mode is unavailable; it never falls back to in-process execution.

## When it runs

The model may call `workflow` only when you explicitly ask for a workflow or a multi-agent run. It never starts one on its own initiative, because a run can fan out to many subagents. A single small delegation stays in the parent session.

## Typed findings gate the next phase

The pattern worth reaching for: a reviewer returns a schema-validated object, and the script branches on it. No wasted agent call to re-read prose, and the fixup step receives structured data instead of guessing which sentence meant "blocking".

```js
export const meta = {
  name: "review",
  description: "Review, then fix only what blocks",
  phases: [{ title: "Review" }, { title: "Fixup", optional: true }],
};
const ITEMS = { type: "array", items: { type: "string" } };
const FINDINGS = { type: "object", properties: { blocking: ITEMS }, required: ["blocking"] };
phase("Review");
const review = await agent(`Review ${args.target}. Do not edit.`, {
  label: "review",
  schema: FINDINGS,
  required: true,
});
if (!review.ok) return { status: "unreviewed", failed: review.error };
const blocking = review.structured.blocking;
if (blocking.length > 0) {
  phase("Fixup");
  await agent(`Fix these findings: ${JSON.stringify(blocking)}`, {
    label: "fixup",
    toolTimeoutMs: 420000,
  });
}
return { blocking, fixed: blocking.length > 0 };
```

`(review.structured && review.structured.blocking) || []` collapses "found nothing" and "no reviewer" into one empty value, so a gate that died reports `blockingCount: 0`. Make gate schemas demand evidence — a field whose description asks for the _verbatim_ output of the command, not a boolean or a summary, because a model that must paste the result cannot summarize a failure into a pass. Then check `.ok` before ever reading `.structured` and poison the aggregate (`return { status: "unreviewed", failed: review.error }`), and mark the gate `required: true` so its failure stops the run instead of resolving `ok: false`. Every run also reports `incompletePhases` — declared phases with no successful agent — computed from agent state rather than from whatever the script returned, and a transport error _after_ a recorded `structured_output` is treated as a delivery failure: the validated result stands, `ok` stays true, and the fault is reported as `deliveryError`. [docs/dsl.md](docs/dsl.md) has the reasoning.

## DSL reference

The async script receives only `phase(title)`, `agent(prompt, options)`, `parallel(thunks, options)`, `args`, and `previous`. `agent()` always resolves `{ ok, output, outputFile, structured?, structuredFile?, error?, deliveryError? }`; check `ok`. `output` is capped for the IPC channel, `outputFile` is the whole answer on disk — hand the path to the next agent rather than interpolating the text into its prompt. A run allows 32 agent calls with global concurrency 4. Each workflow stays attached to its tool call. It shows throttled live progress in the current pi session. Use another pi session for independent work. Pass `resume: "wf_…"` to hand a previous run's returned value to the script as the frozen `previous` global, so redoing one failed gate does not re-pay for the phases that passed — see [docs/dsl.md](docs/dsl.md).

Before a run writes artifacts or starts agents, static preflight checks each decidable `agent()` call. It reports option locations and all unknown literal models. It catches blank prompts, unknown literal option keys, and invalid literal combinations. Dynamic values use the same validation when each call executes.

| Option              | Meaning                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `label`, `phase`    | Progress-UI naming and grouping.                                                     |
| `schema`            | JSON Schema; requires a terminating `structured_output` call and fills `structured`. |
| `model`, `provider` | Override the session model. Static literals are validated before the run starts.     |
| `effort`            | Thinking level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.           |
| `toolTimeoutMs`     | Per-tool-call timeout. Default 180000, maximum 600000.                               |
| `maxDurationMs`     | Optional wall-clock deadline for one agent. Maximum 3600000.                         |
| `required`          | Gate: failure stops the run. `optional` is its inverse: failure is not a hole.       |

Declare a conditional phase as `{ title, optional: true }` so a clean run reports it as skipped rather than pending, and mark a speculative agent `optional: true` so a phase served only by best-effort work is not flagged as a hole (`required` and `optional` together are rejected). Use `maxDurationMs` to bound an agent that can keep making legal tool calls indefinitely; timeout resolves `ok: false`, and a required timeout stops the run. Unknown option keys are rejected rather than ignored, so a typo such as `thinking` fails immediately instead of silently inheriting a default.

## Child agent isolation

Each `agent()` call uses a fresh in-memory pi session with the parent working directory, normal trust-aware resources, and pi's default tools. The extension excludes recursive orchestration and user-input tools. It does not add read-only mode, filesystem write fences, or a shell command policy. The Node permission sandbox contains only the model-authored workflow script; child agent sessions and their tools run in the host process. See [the upstream sandbox research](docs/research/upstream-workflow-agent-sandbox.md).

## Inspect runs

`/workflows` opens the session dashboard. Select a run, inspect phase and agent detail, open bounded transcripts, and press `s` to save `report.md`. `/workflows <runId>` opens one run. Print, JSON, and RPC modes receive a plain-text fallback.

## Artifacts

Each run is checkpointed under `~/.pi/agent/workflows/<runId>/` with `script.js`, optional `args.json`, `workflow.json`, `result.json`, and `transcripts.json`. Writes are bounded and atomic. Transcripts include assistant thinking, tool calls/results, and execution timings within fixed size limits. Every agent also gets `agents/<index>-<label>/output.md` and, with a schema, `structured.json` — written the moment the agent finishes, so an answer survives a run that dies afterwards, and bounded far more loosely than every other channel because nothing forwards them. They are what `outputFile` and `structuredFile` point at. Old runs are pruned at the start of each new run: the newest 20 keep their payloads, runs 21-50 keep only metadata so they stay listable and resumable, and older ones are removed.

## Notes and caveats

- `effort` is the DSL name for pi's internal `thinkingLevel`. Some hosts map `off`, `minimal`, or `xhigh` to `null` in `models.json`; requesting one of those is not an error and is not honored.
- The useful concurrency ceiling is below the policy cap of 4 when agents run compilers, because they contend for CPU. Pass a lower `concurrency` to `parallel()`.
- Run each verification gate as its own bash call even with a raised `toolTimeoutMs`; it keeps failure attribution clear.
- **Windows:** a bash shell is required (Git Bash, MSYS2, Cygwin, or WSL) because pi resolves bash on Windows and throws without it. PowerShell is not used as the child shell; supporting it would require a change in pi itself.
- Runtime services pin `effect` exactly to `4.0.0-beta.101`. Effect v4 is beta software; change the pin only with a full gate run.

- Ported from [`davis7dotsh/my-pi-setup`](https://github.com/davis7dotsh/my-pi-setup) and since extended. `toolTimeoutMs`, `maxDurationMs`, `required`, optional phases and agents, unknown-key rejection, pre-run validation, `incompletePhases`, and delivery-failure salvage are additions and are not upstream DSL.

## Verify

Run `pnpm format && pnpm typecheck && pnpm lint && pnpm line-count && pnpm test && npm pack --dry-run`.
