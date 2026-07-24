import type { Expression, Identifier, Literal, ObjectExpression, Property } from "acorn";

function identifier(node: Expression): node is Identifier {
  return node.type === "Identifier";
}

function literal(node: Expression): node is Literal {
  return node.type === "Literal";
}

export function propertyName(property: Property) {
  if (property.computed || property.kind !== "init" || property.method) return undefined;
  if (identifier(property.key)) return property.key.name;
  if (literal(property.key) && typeof property.key.value === "string") return property.key.value;
  return undefined;
}

export function literalValue(node: Expression, depth = 0): unknown {
  if (depth > 8) throw new Error("workflow metadata is nested too deeply");
  if (literal(node)) {
    const supported =
      node.value === null || ["string", "number", "boolean"].includes(typeof node.value);
    if (supported) return node.value;
    throw new Error("workflow metadata contains an unsupported literal");
  }
  if (node.type === "ArrayExpression") {
    return node.elements.map((item) => {
      if (!item || item.type === "SpreadElement") {
        throw new Error("workflow metadata arrays cannot contain holes or spreads");
      }
      return literalValue(item, depth + 1);
    });
  }
  if (node.type === "ObjectExpression") {
    const value: Record<string, unknown> = Object.create(null);
    for (const item of (node as ObjectExpression).properties) {
      if (item.type !== "Property" || item.shorthand) {
        throw new Error("workflow metadata must contain only static literals");
      }
      const name = propertyName(item as Property);
      if (!name) throw new Error("workflow metadata keys must be plain literals");
      value[name] = literalValue(item.value, depth + 1);
    }
    return value;
  }
  throw new Error("workflow metadata must contain only static literals");
}
