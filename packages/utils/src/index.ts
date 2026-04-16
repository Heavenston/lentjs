export { createLazyProxy } from "./lazy-proxy";

export class AssertionFailedError extends Error {
  public readonly cb: (() => boolean) | null;

  constructor(cb: (() => boolean) | null, message?: string) {
    super(message ?? `Assertion ${cb ? cb.toString()+" " : ""}failed`);
    this.cb = cb;
  }
}

export function assert(value: boolean, message?: string): asserts value;
export function assert(value: () => boolean, message?: string): void;
export function assert(value: boolean | (() => boolean), message?: string) {
  const success = isFunction(value) ? value() : value;
  if (!success) {
    throw new AssertionFailedError(isFunction(value) ? value : null, message);
  }
}

export function unreachable(_value: never): never {
  throw new Error("Reached unreachabble");
}

export function noop(): void {}
export function identity<T>(val: T): T { return val }
export function constant<T>(val: T): (() => T) { return (identity<T>).bind(null, val); }
export function getProperty<T, K extends keyof T>(val: T, key: K): T[K] { return val[key]; }

export function notNull<T>(val: T): NonNullable<T> {
  assert(val != null);
  return val;
}

export function isFunction(t: unknown): t is (...args: any) => any {
  return typeof t === "function";
}

export function isObject(t: unknown): t is object {
  return (typeof t === "function" || typeof t === "object") && t !== null;
}

export function filterInPlace<T>(arr: T[], pred: (v: T) => boolean) {
  arr.splice(0, Infinity, ...arr.filter(pred));
  // let j = 0;
  // for (let i = 0; i < arr.length; i++) {
  //   const val = arr[i]!;
  //   if (pred(val))
  //     arr[j++] = val;
  // }
  // arr.length = j;
}

export function remove<T>(arr: T[], val: T) {
  filterInPlace(arr, val2 => val !== val2);
}

const alphabet = "acdefghijklmnoqrstuvwxyz";
let currentAlphabet = 0;
export function createUid(): string {
  if (typeof document !== "undefined")
    return crypto.randomUUID().split("-",1)[0]!;
  let result = "";
  for (let i = 0; currentAlphabet+1 >= alphabet.length**i; i++) {
    result += alphabet.charAt(Math.trunc(currentAlphabet / (alphabet.length ** i)) % alphabet.length);
  }
  currentAlphabet += 1;
  return result;
}
