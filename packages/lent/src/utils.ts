
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
