export interface SelectionWindow<T> {
  offset: number;
  items: T[];
  clippedBefore: boolean;
  clippedAfter: boolean;
}

export function selectionWindow<T>(items: T[], selected: number, capacity: number) {
  const size = Math.max(1, capacity);
  const bounded = Math.max(0, Math.min(selected, items.length - 1));
  const offset = Math.max(0, Math.min(bounded - Math.floor(size / 2), items.length - size));
  const visible = items.slice(offset, offset + size);
  return {
    offset,
    items: visible,
    clippedBefore: offset > 0,
    clippedAfter: offset + visible.length < items.length,
  } satisfies SelectionWindow<T>;
}
