import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createProgressEmitter } from "../run/progress.ts";
import { PROGRESS_INTERVAL_MS } from "../run/limits.ts";
import { renderWorkflowCall } from "../presentation/render-call.ts";
import { renderWorkflowResult } from "../presentation/render-result.ts";
import { workflowDetails } from "./fixtures.ts";

const theme = {
  bold: (text: string) => text,
  fg: (_color: string, text: string) => text,
} as unknown as ExtensionContext["ui"]["theme"];

test("unchanged workflow progress does not publish another redraw", () => {
  const details = workflowDetails();
  const updates: unknown[] = [];
  const progress = createProgressEmitter(
    () => details,
    (update) => updates.push(update),
  );
  progress.flush();
  progress.flush();
  assert.equal(updates.length, 1);
});

test("changed workflow progress still publishes", () => {
  const details = workflowDetails();
  const updates: unknown[] = [];
  const progress = createProgressEmitter(
    () => details,
    (update) => updates.push(update),
  );
  progress.flush();
  details.currentPhase = "Review";
  progress.flush();
  assert.equal(updates.length, 2);
});

test("workflow UI refreshes no more than twice per second", () => {
  assert.ok(PROGRESS_INTERVAL_MS >= 500);
});

test("partial workflow arguments keep one stable call header", () => {
  const input = {
    script: `export const meta = { name: "review", phases: [{ title: "Scan" }] };`,
  };
  const first = renderWorkflowCall(input, theme, undefined, false);
  const second = renderWorkflowCall(input, theme, first, false);
  assert.strictEqual(second, first);
  assert.doesNotMatch(second.render(100).join("\n"), /Scan/);
  renderWorkflowCall(input, theme, second, true);
  assert.match(second.render(100).join("\n"), /workflow review/);
});

test("workflow call does not render phases that have not started", () => {
  const input = {
    script: `export const meta = {
      name: "review",
      phases: [{ title: "Scan", detail: "Read every file" }],
    };`,
  };
  const component = renderWorkflowCall(input, theme);
  assert.doesNotMatch(component.render(100).join("\n"), /Scan|Read every file/);
});

test("workflow result rendering reuses the previous component", () => {
  const result = {
    content: [{ type: "text", text: "running" }],
    details: workflowDetails(),
  };
  const first = renderWorkflowResult(result, true, theme);
  const second = renderWorkflowResult(result, true, theme, first);
  assert.strictEqual(second, first);
});
