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
      const { end, unsubscribe } = startStoreReadListen(() => {
        unsubscribe();
        debounceRun();
      });
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
