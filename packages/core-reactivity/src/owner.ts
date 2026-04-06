import { ownerToRoot, rootToOwner, type Owner } from "./owner-internal";
import { createRoot, enterRoot, getCurrentRoot } from "./root-internal";
import type { CapturedTaskData } from "./task";

export function getOwner(): Owner | null {
  return rootToOwner(getCurrentRoot());
}

export function createOwner(parent?: Owner | null): [owner: Owner, cleanup: () => void] {
  const [root, cleanup] = rootToOwner(createRoot(parent === undefined ? {} : { parent: ownerToRoot(parent) }));
  return [rootToOwner(root), cleanup];
}

export type CapturedOwnerData = {
  tasks: CapturedTaskData[],
};

export function createCapturingOwner(parent?: Owner | null): [owner: Owner, capture: () => CapturedOwnerData] {
  const [root, cleanup] = rootToOwner(createRoot(parent === undefined ? {} : { parent: ownerToRoot(parent) }));
  const capture = (): CapturedOwnerData => {
    cleanup();
    return {
      tasks: root.tasks!.map<CapturedTaskData>(p => [p.cb, p.capture()]),
    };
  };
  return [rootToOwner(root), capture];
}

export function enterOwner<A extends any[], T>(root: Owner, cb: (...args: A) => T, ...args: A): T {
  return enterRoot(ownerToRoot(root), cb, ...args);
}

export function onCleanup(cb: () => void, owner?: Owner) {
  const currentOwner = owner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onCleanup with an owner");
  }
  const currentRoot = ownerToRoot(currentOwner);
  if (currentRoot.cleaned)
    cb();
  else
    currentRoot.cleanupCallbacks.push(cb);
}
