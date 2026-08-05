import { parse } from "acorn";
import { literalValue, propertyName } from "./literals.ts";

export interface StaticAgentCall {
  line: number;
  column: number;
  optionKeys: string[];
  options?: Record<string, unknown>;
  emptyPrompt: boolean;
}

interface Node {
  type: string;
  start?: number;
  loc?: { start: { line: number; column: number } };
  [key: string]: unknown;
}

const MAX_NODES = 200_000;
const SKIP_KEYS = new Set(["type", "start", "end", "loc", "range"]);

function isNode(value: unknown): value is Node {
  return (
    !!value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string"
  );
}

function isAgentCall(node: Node) {
  const callee = node.callee;
  return isNode(callee) && callee.type === "Identifier" && callee.name === "agent";
}

function inspectCall(node: Node): StaticAgentCall {
  const args = Array.isArray(node.arguments) ? node.arguments : [];
  const prompt = args[0];
  const emptyPrompt =
    prompt === undefined ||
    (isNode(prompt) &&
      prompt.type === "Literal" &&
      typeof prompt.value === "string" &&
      !prompt.value.trim());
  const optionKeys: string[] = [];
  let options: Record<string, unknown> | undefined;
  const optionNode = args[1];
  if (isNode(optionNode) && optionNode.type === "ObjectExpression") {
    const properties = Array.isArray(optionNode.properties) ? optionNode.properties : [];
    for (const property of properties) {
      if (!isNode(property) || property.type !== "Property") continue;
      const name = propertyName(property as never);
      if (name) optionKeys.push(name);
    }
    try {
      options = literalValue(optionNode as never) as Record<string, unknown>;
    } catch {
      // Dynamic values are valid; only statically decidable option objects are resolved here.
    }
  }
  return {
    line: node.loc?.start.line ?? 1,
    column: (node.loc?.start.column ?? 0) + 1,
    optionKeys,
    options,
    emptyPrompt,
  };
}

/** Collect lintable facts from every plain `agent()` call in source order. */
export function collectStaticAgentCalls(source: string): StaticAgentCall[] {
  const program = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true,
    locations: true,
  });
  const stack: unknown[] = [program];
  const found: Array<{ call: StaticAgentCall; start: number }> = [];
  let visited = 0;
  while (stack.length > 0 && visited < MAX_NODES) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!isNode(current)) continue;
    visited++;
    if (current.type === "CallExpression" && isAgentCall(current)) {
      found.push({ call: inspectCall(current), start: current.start ?? 0 });
    }
    for (const key of Object.keys(current)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = current[key];
      if (Array.isArray(value) || isNode(value)) stack.push(value);
    }
  }
  return found.sort((left, right) => left.start - right.start).map(({ call }) => call);
}
