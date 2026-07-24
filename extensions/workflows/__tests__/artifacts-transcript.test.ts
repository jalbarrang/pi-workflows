import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedArtifactTranscript } from "../artifacts/index.ts";

test("artifact transcript keeps the initial prompt, marker, and newest entries", () => {
  const prompt = `initial:${"p".repeat(70)}`;
  const transcript = [
    { role: "user" as const, text: prompt },
    ...Array.from({ length: 5 }, (_, index) => ({
      role: "assistant" as const,
      text: `entry-${index}:${String(index).repeat(70)}`,
    })),
  ];
  const bounded = boundedArtifactTranscript(transcript, { maxBytes: 256, entryMaxBytes: 80 });
  assert.equal(bounded[0]?.role, "user");
  assert.equal(bounded[0]?.text, prompt);
  assert.match(bounded[1]?.text ?? "", /artifact transcript truncated/);
  assert.equal(bounded.at(-1)?.text, transcript.at(-1)?.text);
  assert.equal(
    bounded.some((entry) => entry.text.startsWith("entry-0:")),
    false,
  );
  const bytes = bounded.reduce((total, entry) => total + Buffer.byteLength(entry.text), 0);
  assert.ok(bytes <= 256);
});
