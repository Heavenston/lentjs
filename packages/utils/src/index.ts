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

export function microtaskDebounce(cb: () => void): () => void {
  let queued = false;
  return () => {
    if (queued)
      return;

    queued = true;
    queueMicrotask(() => {
      queued = false;
      cb();
    });
  };
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

export function createUid(): string {
  if (typeof document === "undefined")
    return crypto.randomUUID().split("-",1)[0]!;
  else
    return crypto.randomUUID();
}
