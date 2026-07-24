import { DEFAULT_MAX_BYTES } from "./limits.ts";
import { toSerializable, type SerializationOptions } from "./normalize.ts";
import { truncateUtf8 } from "./utf8.ts";

export function safeStringify(value: unknown, options: SerializationOptions = {}) {
  const maxBytes = Math.max(256, options.maxBytes ?? DEFAULT_MAX_BYTES);
  const serialized = JSON.stringify(toSerializable(value, options), null, 2) ?? "null";
  if (Buffer.byteLength(serialized) <= maxBytes) return serialized;
  let previewBytes = Math.max(32, Math.floor(maxBytes / 3));
  while (previewBytes > 0) {
    const fallback = JSON.stringify(
      {
        truncated: true,
        reason: `serialized value exceeded ${maxBytes} bytes`,
        preview: truncateUtf8(serialized, previewBytes),
      },
      null,
      2,
    );
    if (Buffer.byteLength(fallback) <= maxBytes) return fallback;
    previewBytes = Math.floor(previewBytes / 2);
  }
  return JSON.stringify({ truncated: true });
}
