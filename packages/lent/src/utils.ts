
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
