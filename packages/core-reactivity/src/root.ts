import { ownerToRoot, rootToOwner, type Owner } from "./owner-internal";
import { createRootInternal, getCurrentRoot } from "./root-internals";
import type { CapturedTaskData } from "./task";

export function getOwner(): Owner | null {
  return rootToOwner(getCurrentRoot());
}

export function createRoot<T>(cb: (cleanup: () => void) => T, detachedOwner?: Owner | null): [cleanup: () => void, val: T] {
  const [_, cleanup, val] = createRootInternal(cb, detachedOwner ? { parent: ownerToRoot(detachedOwner) } : {});
  return [cleanup, val];
}

export type CapturedRootData = {
  cleanup: () => void,
  tasks: CapturedTaskData[],
};

export function createCapturingRoot<T>(cb: () => T, detachedOwner?: Owner | null): [CapturedRootData, T] {
  const [root, cleanup, val] = createRootInternal(cb, {
    tasks: [],
    ...(detachedOwner ? { parent: ownerToRoot(detachedOwner) } : {}),
  })
  return [{
    cleanup,
    tasks: root.tasks!.map<CapturedTaskData>(p => [p.cb, p.capture()]),
  }, val];
}

export function onCleanup(cb: () => void) {
  const currentRoot = getCurrentRoot();
  if (currentRoot === null) {
    throw new Error("Can only call onCleanup within a root");
  }
  if (currentRoot.cleaned)
    cb();
  else
    currentRoot.cleanupCallbacks.push(cb);
}
