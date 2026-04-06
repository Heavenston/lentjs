import { noop, remove, unreachable } from "@lentjs/utils";
import { ownerToRoot, rootToOwner, type Owner } from "./owner-internal";
import { createRoot, enterRoot, getCurrentRoot, RootState } from "./root-internal";
import type { CapturedTaskData } from "./task";

export type OwnerCleanup = (() => void) & { detach(): void };

export function getOwner(): Owner | null {
  return rootToOwner(getCurrentRoot());
}

export function createOwner(parent?: Owner | null): [owner: Owner, cleanup: OwnerCleanup] {
  const [root, cleanup] = rootToOwner(createRoot(parent === undefined ? {} : { parent: ownerToRoot(parent) }));
  return [rootToOwner(root), cleanup];
}

export type CapturedOwnerData = {
  tasks: CapturedTaskData[],
};

export function createCapturingOwner(parent?: Owner | null): [owner: Owner, capture: () => CapturedOwnerData] {
  const [root, cleanup] = rootToOwner(createRoot({
    tasks: [],
    ...(parent === undefined ? {} : { parent: ownerToRoot(parent) }),
  }));
  const capture = (): CapturedOwnerData => {
    cleanup();
    return {
      tasks: root.tasks!.map<CapturedTaskData>(p => [p.cb, p.capture()]),
    };
  };
  return [rootToOwner(root), capture];
}

export function enterOwner<A extends any[], T>(root: Owner | null, cb: (...args: A) => T, ...args: A): T {
  return enterRoot(ownerToRoot(root), cb, ...args);
}

export function onCleanup(cb: () => void, owner?: Owner): () => void {
  const currentOwner = owner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onCleanup with an owner");
  }
  const currentRoot = ownerToRoot(currentOwner);
  switch (currentRoot.state) {
  case RootState.Live:
    currentRoot.cleanupCallbacks.push(cb);
    return () => {
      if (currentRoot.state === RootState.Live)
        remove(currentRoot.cleanupCallbacks, cb);
    };
  case RootState.Detached:
    // We do not bother to store the callback, it will never be called
    return noop;
  case RootState.Cleaned:
    cb();
    return noop;
  default: unreachable(currentRoot.state);
  }
}
