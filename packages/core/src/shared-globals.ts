export const global_directive_data_array: unknown[] = [];

export function sharedSSRSerialize(value: unknown): number {
  const idx = global_directive_data_array.length;
  global_directive_data_array.push(value);
  return idx;
}
