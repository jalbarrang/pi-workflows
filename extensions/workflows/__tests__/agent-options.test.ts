import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeOptions } from "../sandbox/helpers.ts";
import { AGENT_OPTION_KEYS, unknownOptionKeyError } from "../sandbox/option-keys.ts";

test("sanitizeOptions keeps documented keys and reports unknown ones", () => {
  const sanitized = sanitizeOptions({
    label: "review",
    effort: "high",
    thinking: "high",
    retries: 3,
  });
  assert.deepEqual(sanitized.options, { label: "review", effort: "high" });
  assert.deepEqual(sanitized.unknownKeys, ["thinking", "retries"]);
});

test("sanitizeOptions omits undefined values without reporting them", () => {
  const sanitized = sanitizeOptions({ label: "review", phase: undefined });
  assert.deepEqual(sanitized.options, { label: "review" });
  assert.deepEqual(sanitized.unknownKeys, []);
});

test("sanitizeOptions treats prototype-polluting keys as unknown", () => {
  const sanitized = sanitizeOptions(JSON.parse('{"__proto__":{"x":1},"label":"safe"}'));
  assert.deepEqual(sanitized.options, { label: "safe" });
  assert.deepEqual(sanitized.unknownKeys, ["__proto__"]);
});

test("the unknown-key error names every offender and the valid set", () => {
  const message = unknownOptionKeyError("scan:client", ["thinking", "retries"]);
  assert.match(message, /agent "scan:client": unknown option keys "thinking", "retries"/);
  for (const key of AGENT_OPTION_KEYS) assert.ok(message.includes(key), `missing ${key}`);
});

test("a single unknown key is reported in the singular", () => {
  const message = unknownOptionKeyError("report", ["thinking"]);
  assert.match(message, /unknown option key "thinking"/);
  assert.doesNotMatch(message, /option keys/);
});
