import { listenForStoreReads, subscribeToStoreReads, type StoreRead } from "./store";
import { microtaskDebounce } from "./utils";

export type TaskCtx = {
  track: <T>(cb: () => T) => T,
  cleanup: (cb: () => void) => void,
};

export type CapturedTask = {
  cb: (ctx: TaskCtx) => void,
  storeReads: StoreRead[],
};

/**
 * When set to an array, instead of subscribing to task depedencies updates
 * they will be appended to this array.
 */
let globalTaskAccumulator: CapturedTask[] | null = null;

function internalCreateOrResumeTask(task: (ctx: TaskCtx) => void, resumeWithStoreReads?: StoreRead[]) {
  const cleanupFunctions: (() => void)[] = [];
  const storeReads: StoreRead[] = [];

  const runCleanups = () => {
    for (const cn of cleanupFunctions)
      cn();
    cleanupFunctions.length = 0;
  };

  const ctx: TaskCtx = {
    track: (trackCb) => {
      const [val, newStoreReads] = listenForStoreReads(() => trackCb());
      storeReads.push(...newStoreReads);
      return val;
    },
    cleanup: (cb) => {
      cleanupFunctions.push(cb);
    },
  };

  const callAndSub = () => {
    runCleanups();
    task(ctx);
    if (globalTaskAccumulator === null) {
      const unsub = subscribeToStoreReads(debounceRun, storeReads, { once: true });
      cleanupFunctions.push(unsub);
    }
    else {
      runCleanups();
      globalTaskAccumulator.push({
        cb: task,
        storeReads: [...storeReads],
      });
    }
    storeReads.length = 0;
  };
  const debounceRun = microtaskDebounce(callAndSub);
  
  if (resumeWithStoreReads) {
    const unsub = subscribeToStoreReads(debounceRun, resumeWithStoreReads, { once: true });
    cleanupFunctions.push(unsub);
  }
  else {
    callAndSub();
  }
}

export function createTask(task: (ctx: TaskCtx) => void) {
  internalCreateOrResumeTask(task);
}

export function resumeTask(task: (ctx: TaskCtx) => void, initialStoreReads: StoreRead[]) {
  internalCreateOrResumeTask(task, initialStoreReads);
}

export function captureTasks<V>(cb: () => V): [tasks: CapturedTask[], returnValue: V] {
  const array: CapturedTask[] = [];
  const prev = globalTaskAccumulator;
  globalTaskAccumulator = array;
  try {
    const val = cb();
    return [array, val];
  }
  catch(e) {
    throw e;
  }
  finally {
    globalTaskAccumulator = prev;
  }
}
