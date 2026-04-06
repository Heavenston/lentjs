import { getCurrentRoot, rootCleanup, runWithRoot, type Root } from "./root-internals";
import type { CapturedTaskData } from "./task";

export function createRoot<T>(cb: (cleanup: () => void) => T): [cleanup: () => void, val: T] {
  const root: Root = {
    cleaned: false,
    parent: getCurrentRoot(),
    cleanupCallbacks: [],
  };
  const cleanup = rootCleanup.bind(root);
  const val = runWithRoot(root, cb, cleanup);
  return [cleanup, val];
}

export type CapturedRootData = {
  cleanup: () => void,
  cleanupCallbacks: (() => void)[],
  tasks: CapturedTaskData[],
};

export function createCapturingRoot<T>(cb: () => T): [CapturedRootData, T] {
  const root: Root = {
    cleaned: false,
    parent: getCurrentRoot(),
    cleanupCallbacks: [],
    tasks: [],
  };
  const cleanup = rootCleanup.bind(root);
  const val = runWithRoot(root, cb);
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
