/**
 * Build an object literal flat, then drop the keys that came out `undefined`.
 *
 * The alternative — `...(x === undefined ? {} : { x })` per optional field — is
 * unreadable at four fields and actively misleading at eight, so it is banned by
 * `no-restricted-syntax` in `eslint.config.js`. But the distinction it encodes is
 * real and must survive: `artifacts/normalize.ts` maps a present-but-`undefined`
 * value to the literal string `"[undefined]"`, so a key that is set rather than
 * omitted lands in `workflow.json` as `"error": "[undefined]"`. That has already
 * happened once — `presentation/dashboard/normalize.ts` still filters the string
 * back out when reading an artifact.
 *
 * So: write the literal flat, let optional fields be `undefined`, and wrap it.
 * Absent stays absent.
 */
export function compact<T extends object>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (item !== undefined) result[key] = item;
  }
  return result as T;
}
