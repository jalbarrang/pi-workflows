import { parse } from "acorn";
import { propertyName } from "./literals.ts";

/** A statically decidable `model`/`provider` pair from one `agent()` call site. */
export interface ModelRef {
  model: string;
  provider?: string;
}

/** Walk budget. Scripts are capped at 512 KB, so this only guards pathological nesting. */
const MAX_NODES = 200_000;
const SKIP_KEYS = new Set(["type", "start", "end", "loc", "range"]);

interface Node {
  type: string;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return (
    !!value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string"
  );
}

function staticString(node: unknown) {
  if (!isNode(node) || node.type !== "Literal") return undefined;
  const value = (node as { value?: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

/**
 * Extract a ref only when the whole pair is static. A dynamic `provider` beside a
 * literal `model` cannot be validated as a pair, so it is skipped rather than
 * guessed — a false "unknown model" would block a valid workflow.
 */
function agentCallRef(node: Node): ModelRef | undefined {
  const callee = node.callee;
  if (!isNode(callee) || callee.type !== "Identifier" || callee.name !== "agent") return undefined;
  const args = Array.isArray(node.arguments) ? node.arguments : [];
  const options = args[1];
  if (!isNode(options) || options.type !== "ObjectExpression") return undefined;
  const properties = Array.isArray(options.properties) ? options.properties : [];
  let model: string | undefined;
  let provider: string | undefined;
  for (const property of properties) {
    if (!isNode(property) || property.type !== "Property") continue;
    const name = propertyName(property as never);
    if (name !== "model" && name !== "provider") continue;
    const value = staticString(property.value);
    if (value === undefined) return undefined;
    if (name === "model") model = value;
    else provider = value;
  }
  if (model === undefined) return undefined;
  return provider === undefined ? { model } : { model, provider };
}

/**
 * Collect statically declared models from every `agent()` call in a script.
 *
 * Iterative on purpose: an explicit worklist cannot overflow the host stack the
 * way recursion over a deeply nested AST could. The worklist pops depth-first in
 * reverse, so results are sorted back into source order before returning — an
 * error listing call sites out of order is needlessly hard to act on.
 */
export function collectModelRefs(source: string): ModelRef[] {
  const program = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true,
  });
  const found: Array<{ ref: ModelRef; start: number }> = [];
  const stack: unknown[] = [program];
  let visited = 0;
  while (stack.length > 0 && visited < MAX_NODES) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!isNode(current)) continue;
    visited++;
    if (current.type === "CallExpression") {
      const ref = agentCallRef(current);
      if (ref) found.push({ ref, start: typeof current.start === "number" ? current.start : 0 });
    }
    for (const key of Object.keys(current)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = current[key];
      if (Array.isArray(value) || isNode(value)) stack.push(value);
    }
  }
  return found.sort((left, right) => left.start - right.start).map((entry) => entry.ref);
}
