# Agent output artifacts

Do not interpolate one agent's output into the next agent's prompt. Pass `outputFile` and tell the next agent to read it:

```js
const recon = await agent("Investigate X and report in full.", { label: "recon" });
if (!recon.ok) return { status: "recon-failed", error: recon.error };
const synthesis = await agent(
  `Read the recon report at ${recon.outputFile} and reconcile it with the plan.`,
  { label: "synthesis" },
);
```

Every result carries the artifact fields, so a script never has to branch on their presence:

- `outputFile` — absolute path to the agent's full final answer, written as `<runDir>/agents/<index>-<label>/output.md`.
- `structuredFile` — absolute path to the validated schema payload, present only when `schema` was used.
- `outputBytes` — size of the file, which may exceed the inline `output`.
- `outputTruncated` — the inline `output` was cut and the file holds strictly more.

The inline `output` stays capped at 64KB because it crosses the IPC channel; the files are capped at 8MB because nothing forwards them. They are written by `agent/runner.ts` at outcome time — before truncation, before session teardown, before the script can throw — so an answer survives the run that produced it.

The motivating failure is run `wf_2cf06cc43747`. Four read-only recon agents finished after 11 minutes. The script built its synthesis prompt out of `JSON.stringify` of their four structured payloads, the prompt passed the 100k-character limit, and the request was rejected as a protocol violation: the sandbox was torn down, the script never reached its `return`, and no `result.json` was written. Salvage from artifacts failed too, because the only surviving copies were transcript entries already collapsed to `{"truncated": true, "reason": "serialized value exceeded 16384 bytes"}`. The re-run, `wf_6a05986a530e`, worked around it by hand — each agent wrote its report to `/tmp` and returned only a path — and three of four reports survived a 48-minute abort at full fidelity. That workaround is now the engine's behaviour.

## Retention

`artifacts/retention.ts` sweeps `~/.pi/agent/workflows/` once per run, at run start in `run/prepare.ts` and never mid-run: a sweep racing a live run's atomic writes would corrupt the run being paid for. Two tiers, because `resume` and the `/workflows` dashboard both read history and age alone is the wrong reason to break them — the newest 20 runs keep everything, runs 21 to 50 lose only their `agents/` payloads and stay listable and resumable, and older runs go entirely. Every run active in this session is protected regardless of age, since a background run can outlive the run that triggers the sweep.

The second half of that fix lives in `sandbox/agent-request.ts`: an oversized prompt is an author error in one `agent()` call, so it resolves `{ ok: false, error }` naming `outputFile` as the remedy, charges nothing to the 32-call budget, and leaves the run and every result already paid for intact. Only a request that cannot be attributed to a call — no usable id, malformed JSON, a bad token — is still fatal.
