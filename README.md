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
  tools: "read-only",
  allowCommands: ["npm run *"],
  required: true,
});
if (!review.ok) return { status: "unreviewed", failed: review.error };
const blocking = review.structured.blocking;
if (blocking.length > 0) {
  phase("Fixup");
  await agent(`Fix these findings: ${JSON.stringify(blocking)}`, {
    label: "fixup",
    writeScope: ["src/**"],
    toolTimeoutMs: 420000,
  });
}
return { blocking, fixed: blocking.length > 0 };
```

`(review.structured && review.structured.blocking) || []` collapses "found nothing" and "no reviewer" into one empty value, so a gate that died reports `blockingCount: 0`. Make gate schemas demand evidence — a field whose description asks for the _verbatim_ output of the command, not a boolean or a summary, because a model that must paste the result cannot summarize a failure into a pass. Then check `.ok` before ever reading `.structured` and poison the aggregate (`return { status: "unreviewed", failed: review.error }`), and mark the gate `required: true` so its failure stops the run instead of resolving `ok: false`. Every run also reports `incompletePhases` — declared phases with no successful agent — computed from agent state rather than from whatever the script returned, and a transport error _after_ a recorded `structured_output` is treated as a delivery failure: the validated result stands, `ok` stays true, and the fault is reported as `deliveryError`. [docs/dsl.md](docs/dsl.md) has the reasoning.

## DSL reference

The async script receives only `phase(title)`, `agent(prompt, options)`, `parallel(thunks, options)`, and `args`. `agent()` always resolves `{ ok, output, structured?, error?, deliveryError?, deniedCommands? }`; check `ok`. A run allows 32 agent calls with global concurrency 4. Pass `background: true` to return immediately and receive a follow-up after settlement; blocking runs render throttled live progress.

| Option              | Meaning                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `label`, `phase`    | Progress-UI naming and grouping.                                                     |
| `schema`            | JSON Schema; requires a terminating `structured_output` call and fills `structured`. |
| `model`, `provider` | Override the session model. Static literals are validated before the run starts.     |
| `effort`            | Thinking level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.           |
| `toolTimeoutMs`     | Per-tool-call timeout. Default 180000, maximum 600000.                               |
| `tools`             | `"read-only"` removes `write`/`edit` and puts bash behind the command policy.        |
| `allowCommands`     | Command globs a governed agent may run, e.g. `["npm run *", "dotnet *"]`.            |
| `writeScope`        | Path globs `write`/`edit` are fenced to, e.g. `["client/**"]`.                       |
| `required`          | Gate: this agent failing stops the run instead of resolving `ok: false`.             |

Declare a conditional phase as `{ title, optional: true }` so a clean run reports it as skipped rather than pending. Unknown option keys are rejected rather than ignored, so a typo such as `thinking` fails immediately instead of silently inheriting a default. Commands the policy refused come back as `deniedCommands` on the result and in the run report, so an agent that did nothing because it was blocked is distinguishable from one that had nothing to do.

## What is actually enforced

`tools: "read-only"` and `writeScope` both route bash through a command policy — a path fence that bash can write around is not a fence. The policy parses each command segment, denies redirects and command substitution, and applies a deny list that `allowCommands` cannot override: shell re-entry, PowerShell, command wrappers such as `env`/`xargs`/`timeout`, interpreter eval flags such as `node -e`, and fetch-and-run launchers such as `npx`.

`writeScope` resolves symlinks and canonical casing before matching, so neither a symlink inside the scope nor a case-only variant escapes it. Requests outside the working directory are refused outright. A write-scoped agent may run two mutating commands — a bare `git mv` whose source and destination both land inside the fence, and a bare `mkdir` of an in-scope path, with no shell metacharacters and no chaining — because a fenced agent that cannot rename a file or create a directory cannot extract a module. A `dir/**` glob matches `dir` itself so a directory can be relocated. `mv`, `cp`, `rm`, and `git mv -f` stay denied and `allowCommands` cannot re-enable them. Two honest limits remain: `allowCommands` grants whatever those commands do, so allowing `npm run *` grants every script in the repo's `package.json`, and a workflow with no `tools` or `writeScope` is unrestricted exactly as before.

## Inspect runs

`/workflows` opens the session dashboard. Select a run, inspect phase and agent detail, open bounded transcripts, and press `s` to save `report.md`. `/workflows <runId>` opens one run. Print, JSON, and RPC modes receive a plain-text fallback.

## Artifacts

Each run is checkpointed under `~/.pi/agent/workflows/<runId>/` with `script.js`, optional `args.json`, `workflow.json`, `result.json`, and `transcripts.json`. Writes are bounded and atomic. Transcripts include assistant thinking, tool calls/results, and execution timings within fixed size limits.

## Notes and caveats

- `effort` is the DSL name for pi's internal `thinkingLevel`. Some hosts map `off`, `minimal`, or `xhigh` to `null` in `models.json`; requesting one of those is not an error and is not honored.
- The useful concurrency ceiling is below the policy cap of 4 when agents run compilers, because they contend for CPU. Pass a lower `concurrency` to `parallel()`.
- Run each verification gate as its own bash call even with a raised `toolTimeoutMs`; it keeps failure attribution clean. Shell control flow (`while`, `for`, `if`), command substitution, redirects, and inline `VAR=x` assignments are never runnable by a governed agent — use `find … -exec wc -l {} +` rather than a `while read` pipeline, or the gate reports "(no output)" and reads like a pass.
- **Windows:** a bash shell is required (Git Bash, MSYS2, Cygwin, or WSL) because pi resolves bash on Windows and throws without it. PowerShell is not used as the child shell; supporting it would require a change in pi itself.
- Runtime services pin `effect` exactly to `4.0.0-beta.101`. Effect v4 is beta software; change the pin only with a full gate run.

## Differences from upstream

Ported from [`davis7dotsh/my-pi-setup`](https://github.com/davis7dotsh/my-pi-setup) and since extended. `toolTimeoutMs`, `tools`, `allowCommands`, `writeScope`, `required`, optional phases, unknown-key rejection, pre-run model validation, `incompletePhases`, and delivery-failure salvage are additions and are not upstream DSL.

## Verify

```bash
pnpm format && pnpm typecheck && pnpm lint && pnpm line-count && pnpm test && npm pack --dry-run
```
