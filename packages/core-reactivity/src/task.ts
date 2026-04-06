import { rootToOwner } from "./owner-internal";
import { createRoot, onCleanup } from "./root";
import { getCurrentRoot } from "./root-internals";
import { listenForStoreReads, subscribeToStoreReads, type StoreRead } from "./store";
import { microtaskDebounce } from "@lentjs/utils";

export type CapturedTaskData = [cb: () => void, storeReads: StoreRead[]];

function internalCreateOrResumeTask(task: () => void, resumeWithStoreReads?: StoreRead[]) {
  const ownerRoot = getCurrentRoot();
  let cleanup: (() => void) | null = null;
  let latestStoreReads: StoreRead[] = [];

  const callAndSub = () => {
    cleanup?.();
    createRoot(newCleanup => {
      cleanup = newCleanup;
      const [_val, storeReads] = listenForStoreReads(() => task());
      latestStoreReads = storeReads;
      const unsub = subscribeToStoreReads(debounceRun, latestStoreReads, { once: true });
      onCleanup(unsub);
    }, rootToOwner(ownerRoot));
  };
  const debounceRun = microtaskDebounce(callAndSub);

  if (ownerRoot?.tasks != null) {
    ownerRoot.tasks.push({
      cb: task,
      capture() {
        cleanup?.();
        return latestStoreReads;
      },
    });
  }
  
  if (resumeWithStoreReads) {
    const unsub = subscribeToStoreReads(debounceRun, resumeWithStoreReads, { once: true });
    onCleanup(unsub);
  }
  else {
    callAndSub();
  }
}

export function createTask(task: () => void) {
  internalCreateOrResumeTask(task);
}

export function resumeTask(task: () => void, initialStoreReads: StoreRead[]) {
  internalCreateOrResumeTask(task, initialStoreReads);
}
