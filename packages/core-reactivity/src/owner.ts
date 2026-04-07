import { owner2Root, type Owner } from "./owner-internal";
import { Root } from "./root-internal";
import type { CapturedTaskData } from "./task";

export type OwnerCleanup = (() => void) & { detach(): void };

export function getOwner(): Owner | null {
  return owner2Root(Root.currentRoot);
}

export function createOwner(parent?: Owner | null): [owner: Owner, cleanup: OwnerCleanup] {
  const [root, cleanup] = Root.create(parent === undefined ? Root.currentRoot : owner2Root(parent), false);
  return [owner2Root(root), cleanup];
}

export type CapturedOwnerData = {
  tasks: CapturedTaskData[],
};

export function createCapturingOwner(parent?: Owner | null): [owner: Owner, capture: () => CapturedOwnerData] {
  const [root, cleanup] = Root.create(parent === undefined ? Root.currentRoot : owner2Root(parent), true);
  const capture = (): CapturedOwnerData => {
    cleanup();
    return {
      tasks: root.tasks!.map<CapturedTaskData>(p => [p.cb, p.capture()]),
    };
  };
  return [owner2Root(root), capture];
}

export function enterOwner<A extends any[], T>(root: Owner, cb: (...args: A) => T, ...args: A): T {
  return owner2Root(root).enter(cb, ...args);
}

export function onCleanup(cb: () => void, inOwner?: Owner): () => void {
  const currentOwner = inOwner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onCleanup with an owner");
  }
  return owner2Root(currentOwner).onCleanup(cb);
}
