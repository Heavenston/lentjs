export class AssertionFailedError extends Error {
  public readonly cb: (() => boolean) | null;

  constructor(cb: (() => boolean) | null, message?: string) {
    super(message ?? `Assertion ${cb} failed`);
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

export function isBindableThis(fn: Function): boolean {
  return Object.prototype.hasOwnProperty.call(fn, "prototype");
}

export type InfiniteFunction<A, B> = A | (() => InfiniteFunction<B, B>);
export function fullCall<A, B>(n: InfiniteFunction<A, B>): A | B {
  if (isFunction(n))
    return fullCall(n());
  return n;
}
