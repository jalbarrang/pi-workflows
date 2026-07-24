import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { safeStringify, writeFileAtomic } from "../artifacts/index.ts";

test("safeStringify handles cycles, bigint, depth, and size", () => {
  const value: Record<string, unknown> = { count: 1n, text: "x".repeat(10_000) };
  value.self = value;
  const text = safeStringify(value, { maxBytes: 1_024, maxStringBytes: 256 });
  assert.ok(Buffer.byteLength(text) <= 1_024);
  assert.doesNotThrow(() => JSON.parse(text));
  assert.match(text, /truncated|circular/);
});
test("atomic writes leave complete readable content", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-atomic-"));
  const target = path.join(directory, "value.json");
  writeFileAtomic(target, '{"value":1}');
  writeFileAtomic(target, '{"value":2}');
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { value: 2 });
  assert.deepEqual(fs.readdirSync(directory), ["value.json"]);
});
