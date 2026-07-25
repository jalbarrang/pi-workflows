# Writing gates

A gate is an agent whose failure must stop the run. Round after round of dogfooding, the gates were what caught work that had not happened — and the ways they failed were always the same two: the check was not evidence, or the check could not run.

## Write gates that paste evidence

A gate whose schema asks for a boolean, or for a summary, is a gate a model can talk its way past. Three runs in one initiative (`wf_502f35f143f6`, `wf_ecbabe1d7078`, `wf_6046e7fd45c1`) reported every agent `ok` while the work had not happened, and all three were caught by the same construction: a `required: true` reviewer whose schema had a field whose _description_ demanded raw command output.

```js
const GATE = {
  type: "object",
  properties: {
    importProof: {
      type: "string",
      description: 'verbatim stdout of `rg -n "quest.service" src`, unedited',
    },
    blocking: { type: "array", items: { type: "string" } },
  },
  required: ["importProof", "blocking"],
};
```

A model that must paste the output cannot summarize a failure into a pass: the contradiction is visible in the artifact. Prefer this to a `passed: boolean`, and put measurements the run depends on into a read-only verify phase rather than into a prompt preamble — a measurement in a prompt is asserted, while one in a gate is checked.

## What a governed agent can actually run

The policy parses a command into segments and requires each to pass independently, so pipes and `&&` chains are fine when every part is individually allowed: `find . -name '*.ts' -exec wc -l {} + | sort -n | tail -5` runs. These constructs are refused no matter what `allowCommands` says, because the matcher never sees the command they would execute:

- shell control flow — `while`, `for`, `if`, `case`, function definitions;
- command substitution — `$(…)` and backticks;
- output redirects, including `2>&1`;
- inline environment assignments — `COUNT=3 cmd`.

This matters most for line-count and grep gates, where `find … | while read f; do wc -l $f; done` is the reflex. That command is unrunnable, and a reviewer that cannot run it reports `"(no output)"`, which reads exactly like a pass. Use `find … -exec wc -l {} +` and let the agent read the numbers. `policy/explain.ts` names the blocked segment and the offending construct in the denial, and the denial also instructs the agent to report being blocked rather than work around it.
