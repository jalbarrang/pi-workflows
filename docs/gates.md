# Writing gates

A gate is an agent whose failure must stop the run. A useful gate records evidence instead of only reporting a verdict.

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

A model that must paste the output cannot summarize a failure into a pass: the contradiction is visible in the artifact. Prefer this to a `passed: boolean`, and put measurements the run depends on into a verify phase rather than into a prompt preamble. A measurement in a prompt is asserted. A measurement from a command is checked.

Child agents receive pi's default tools and can run normal shell commands. The workflow extension does not add a command policy. Keep each verification command separate so the result identifies the failed check.
