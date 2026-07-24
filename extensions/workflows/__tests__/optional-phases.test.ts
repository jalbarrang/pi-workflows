import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport } from "../presentation/dashboard/report.ts";
import { isSkippedPhase, phaseGroups } from "../run/groups.ts";
import { sanitizeMeta } from "../scripting/sanitize.ts";
import { workflowDetails } from "./fixtures.ts";

test("sanitizeMeta accepts optional only as a literal boolean", () => {
  const meta = sanitizeMeta({
    phases: [
      { title: "Scan" },
      { title: "Fixup", optional: true },
      { title: "Loose", optional: 1 },
    ],
  });
  assert.deepEqual(meta.phases, [
    { title: "Scan" },
    { title: "Fixup", optional: true },
    { title: "Loose" },
  ]);
});

test("an optional phase with no agents is skipped, a required one is not", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Scan" }, { title: "Fixup", optional: true }];
  const groups = phaseGroups(details, true);
  assert.deepEqual(
    groups.map((group) => [group.title, isSkippedPhase(group)]),
    [
      ["Scan", false],
      ["Fixup", true],
    ],
  );
});

test("an optional phase that ran is not reported as skipped", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Fixup", optional: true }];
  details.agents = [
    {
      index: 1,
      label: "fixup",
      phase: "Fixup",
      state: "done",
      startedAt: 1,
      preview: "",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      transcript: [],
    },
  ];
  const group = phaseGroups(details, true)[0];
  assert.equal(isSkippedPhase(group), false);
});

test("the saved report distinguishes skipped optional phases from empty ones", () => {
  const details = workflowDetails();
  details.phases = [{ title: "Scan" }, { title: "Fixup", optional: true }];
  const report = buildReport(details);
  assert.match(report, /## Fixup\n\n_skipped \(optional\)_/);
  assert.match(report, /## Scan\n\n_no agents_/);
});
