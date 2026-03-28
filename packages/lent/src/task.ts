import { startStoreReadListen } from "./store";
import { microtaskDebounce } from "./utils";

export type TaskCtx = {
  track: <T>(cb: () => T) => T,
  cleanup: (cb: () => void) => void,
};
export function createTask(task: (ctx: TaskCtx) => void) {
  const cleanup_functions: (() => void)[] = [];

  const debounceRun = microtaskDebounce(() => task(ctx));

  const ctx: TaskCtx = {
    track: (track_cb) => {
      const { end, unsubscribe } = startStoreReadListen({ onUpdate: debounceRun, once: true });
      cleanup_functions.push(unsubscribe);
      const val = track_cb();
      end();
      return val;
    },
    cleanup: (cb) => {
      cleanup_functions.push(cb);
    },
  };
  
  debounceRun();
}

export function immediateTrack<T, R>(getValue: (previous?: T) => T, fn1: (val: T) => R, fn2?: (val: T) => void): R {
  let previous_val: T | undefined;
  const run = () => {
    const { end } = startStoreReadListen({ onUpdate: debounced, once: true });
    const val = getValue(previous_val);
    end();
    previous_val = val;
    return val;
  };
  const debounced = microtaskDebounce(() => {
    (fn2 ?? fn1)(run());
  });
  return fn1(run());
}
