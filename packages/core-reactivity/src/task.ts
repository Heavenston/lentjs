import { onCleanup } from "./root";
import { getCurrentRoot } from "./root-internals";
import { listenForStoreReads, subscribeToStoreReads, type StoreRead } from "./store";
import { microtaskDebounce } from "@lentjs/utils";

export type TaskCtx = {
  track: <T>(cb: () => T) => T,
  cleanup: (cb: () => void) => void,
};

export type CapturedTaskData = [cb: (ctx: TaskCtx) => void, storeReads: StoreRead[]];

function internalCreateOrResumeTask(task: (ctx: TaskCtx) => void, resumeWithStoreReads?: StoreRead[]) {
  const ownerRoot = getCurrentRoot();
  const cleanupFunctions: (() => void)[] = [];
  let storeReadsAccumulator: StoreRead[] = [];
  let latestStoreReads: StoreRead[] = [];

  const runCleanups = () => {
    for (const cn of cleanupFunctions)
      cn();
    cleanupFunctions.length = 0;
  };
  onCleanup(runCleanups);

  const ctx: TaskCtx = {
    track: (trackCb) => {
      const [val, newStoreReads] = listenForStoreReads(() => trackCb());
      storeReadsAccumulator.push(...newStoreReads);
      return val;
    },
    cleanup: (cb) => {
      cleanupFunctions.push(cb);
    },
  };

  const callAndSub = () => {
    runCleanups();
    task(ctx);
    latestStoreReads = storeReadsAccumulator;
    storeReadsAccumulator = [];
    const unsub = subscribeToStoreReads(debounceRun, latestStoreReads, { once: true });
    cleanupFunctions.push(unsub);
    storeReadsAccumulator.length = 0;
  };
  const debounceRun = microtaskDebounce(callAndSub);

  if (ownerRoot?.tasks != null) {
    ownerRoot.tasks.push({
      cb: task,
      capture() {
        runCleanups();
        return latestStoreReads;
      },
    });
  }
  
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
