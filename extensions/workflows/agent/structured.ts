import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { STRUCTURED_OUTPUT_TOOL_DESCRIPTION } from "../presentation/prompt.ts";

function isJsonSchema(value: unknown): value is TSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const seen = new WeakSet<object>();
  let nodes = 0;
  const validate = (current: unknown, depth: number): boolean => {
    if (++nodes > 10_000 || depth > 24) return false;
    if (current === null || ["string", "boolean"].includes(typeof current)) return true;
    if (typeof current === "number") return Number.isFinite(current);
    if (Array.isArray(current)) return current.every((item) => validate(item, depth + 1));
    if (typeof current !== "object" || seen.has(current)) return false;
    seen.add(current);
    return Object.keys(current).every((key) => {
      if (["__proto__", "constructor", "prototype"].includes(key)) return false;
      return validate((current as Record<string, unknown>)[key], depth + 1);
    });
  };
  return validate(value, 0);
}

export function makeStructuredOutputTool(
  schema: unknown,
  capture: (value: unknown) => void,
): ToolDefinition {
  if (!isJsonSchema(schema)) {
    throw new Error("structured output schema must be a bounded JSON object");
  }
  return defineTool({
    name: "structured_output",
    label: "Structured Output",
    description: STRUCTURED_OUTPUT_TOOL_DESCRIPTION,
    parameters: Type.Unsafe(schema),
    async execute(_id, params) {
      capture(params);
      return {
        content: [{ type: "text", text: "Recorded structured result." }],
        details: params,
        terminate: true,
      };
    },
  });
}
