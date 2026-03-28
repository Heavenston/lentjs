import serializeJS from "serialize-javascript";

export function serialize(value: unknown): string {
  return serializeJS(value);
}

export function deserialize(text: string): unknown {
  return eval(`(${text})`);
}
