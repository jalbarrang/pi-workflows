import { DEFAULT_MAX_DEPTH, DEFAULT_MAX_NODES, DEFAULT_MAX_STRING_BYTES } from "./limits.ts";
import { truncateUtf8 } from "./utf8.ts";

export interface SerializationOptions {
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxStringBytes?: number;
}

export function toSerializable(value: unknown, options: SerializationOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxString = options.maxStringBytes ?? DEFAULT_MAX_STRING_BYTES;
  const seen = new WeakMap<object, string>();
  let nodes = 0;
  const visit = (current: unknown, depth: number, location: string): unknown => {
    if (++nodes > maxNodes) return "[truncated: node limit]";
    if (depth > maxDepth) return "[truncated: depth limit]";
    if (current === null || typeof current === "boolean") return current;
    if (typeof current === "string") {
      return Buffer.byteLength(current) <= maxString
        ? current
        : `${truncateUtf8(current, maxString)}\n[truncated: string limit]`;
    }
    if (typeof current === "number")
      return Number.isFinite(current) ? current : `[number: ${current}]`;
    if (typeof current === "bigint") return `${current}n`;
    if (typeof current === "undefined") return "[undefined]";
    if (typeof current === "symbol") return `[symbol: ${current.description ?? ""}]`;
    if (typeof current === "function") return `[function: ${current.name || "anonymous"}]`;
    if (typeof current !== "object") return String(current);
    const prior = seen.get(current);
    if (prior) return `[circular: ${prior}]`;
    seen.set(current, location);
    if (Array.isArray(current)) {
      return current.map((item, index) => visit(item, depth + 1, `${location}[${index}]`));
    }
    if (current instanceof Date)
      return Number.isNaN(current.getTime()) ? "[date: invalid]" : current.toISOString();
    if (current instanceof Error) {
      return { name: current.name, message: current.message, stack: current.stack };
    }
    const result: Record<string, unknown> = Object.create(null);
    let keys: string[];
    try {
      keys = Object.keys(current);
    } catch (error) {
      return `[unreadable object: ${String(error)}]`;
    }
    for (const key of keys) {
      try {
        result[key] = visit(
          (current as Record<string, unknown>)[key],
          depth + 1,
          `${location}.${key}`,
        );
      } catch (error) {
        result[key] = `[unreadable property: ${String(error)}]`;
      }
    }
    return result;
  };
  return visit(value, 0, "$root");
}
