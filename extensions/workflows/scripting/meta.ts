import { parse, type Program } from "acorn";
import { literalValue } from "./literals.ts";
import { emptyMeta, sanitizeMeta } from "./sanitize.ts";
import type { PreparedWorkflowScript, WorkflowMeta } from "./types.ts";

function metadataDeclaration(statement: Program["body"][number]) {
  if (statement.type === "ImportDeclaration") {
    throw new Error("workflow scripts cannot use static imports");
  }
  if (statement.type !== "ExportNamedDeclaration") return undefined;
  if (
    statement.source ||
    statement.specifiers.length ||
    statement.declaration?.type !== "VariableDeclaration"
  ) {
    throw new Error("workflow scripts may only export static meta");
  }
  const declaration = statement.declaration;
  const item = declaration.declarations[0];
  const valid =
    declaration.kind === "const" &&
    declaration.declarations.length === 1 &&
    item.id.type === "Identifier" &&
    item.id.name === "meta" &&
    item.init;
  if (!valid) throw new Error("workflow metadata must be export const meta = {...}");
  return { start: statement.start, end: statement.end, value: literalValue(item.init!) };
}

export function prepareWorkflowScript(source: string): PreparedWorkflowScript {
  const program = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true,
  });
  let range: { start: number; end: number } | undefined;
  let meta = emptyMeta();
  for (const statement of program.body) {
    if (
      statement.type === "ExportDefaultDeclaration" ||
      statement.type === "ExportAllDeclaration"
    ) {
      throw new Error("workflow scripts may only export static meta");
    }
    const found = metadataDeclaration(statement);
    if (!found) continue;
    if (range) throw new Error("workflow metadata may only be declared once");
    range = found;
    meta = sanitizeMeta(found.value);
  }
  if (!range) return { source, meta };
  const removed = source.slice(range.start, range.end);
  const blank = `;${removed.slice(1).replace(/[^\n\r]/g, " ")}`;
  return { source: source.slice(0, range.start) + blank + source.slice(range.end), meta };
}

const cache = new Map<string, WorkflowMeta>();
export function extractMeta(source: string) {
  const saved = cache.get(source);
  if (saved) return saved;
  let meta = emptyMeta();
  try {
    meta = prepareWorkflowScript(source).meta;
  } catch {}
  if (cache.size >= 32) cache.clear();
  cache.set(source, meta);
  return meta;
}
