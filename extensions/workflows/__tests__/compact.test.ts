import assert from "node:assert/strict";
import { test } from "node:test";
import { toSerializable } from "../artifacts/index.ts";
import { compact } from "../shared/compact.ts";

test("only undefined is dropped, every other falsy value survives", () => {
  const result = compact({ a: undefined, b: null, c: false, d: 0, e: "", f: Number.NaN });
  assert.equal("a" in result, false);
  assert.deepEqual(Object.keys(result), ["b", "c", "d", "e", "f"]);
});

test("an omitted key cannot serialize as the string [undefined]", () => {
  // The failure this guards: toSerializable maps a present-but-undefined value to
  // "[undefined]", which then lands in workflow.json and has to be filtered back
  // out when the dashboard reads the artifact.
  // toSerializable builds null-prototype objects, so compare the plain shape.
  const plain = (value: unknown) => ({ ...(toSerializable(value) as object) });
  assert.deepEqual(plain({ ok: true, error: undefined }), { ok: true, error: "[undefined]" });
  assert.deepEqual(plain(compact({ ok: true, error: undefined })), { ok: true });
});

test("nested values are left exactly as they are", () => {
  const nested = { keep: undefined, deep: { alsoKeep: undefined } };
  const result = compact(nested);
  assert.equal("keep" in result, false);
  assert.deepEqual(result.deep, nested.deep);
  assert.equal(result.deep, nested.deep);
});
