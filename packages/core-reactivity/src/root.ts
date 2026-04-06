import { createRootInternal, getCurrentRoot } from "./root-internals";
import type { CapturedTaskData } from "./task";

export function createRoot<T>(cb: (cleanup: () => void) => T): [cleanup: () => void, val: T] {
  const [_, cleanup, val] = createRootInternal(cb, {});
  return [cleanup, val];
}

export type CapturedRootData = {
  cleanup: () => void,
  cleanupCallbacks: (() => void)[],
  tasks: CapturedTaskData[],
};

export function createCapturingRoot<T>(cb: () => T): [CapturedRootData, T] {
  const [root, cleanup, val] = createRootInternal(cb, {
    tasks: [],
  })
  return [{
    cleanup,
    cleanupCallbacks: root.cleanupCallbacks,
    tasks: root.tasks!.map<CapturedTaskData>(p => [p.cb, p.capture()]),
  }, val];
}

export function onCleanup(cb: () => void) {
  const currentRoot = getCurrentRoot();
  if (currentRoot === null) {
    throw new Error("Can only call onCleanup within a root");
  }
  currentRoot.cleanupCallbacks.push(cb);
}
