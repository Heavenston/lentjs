export type { Owner } from "./owner-internal";

import { convertOwner, type Owner } from "./owner-internal";
import { Root, RootState } from "./root-internal";

export type OwnerCleanup = (() => void) & { detach(): void };

export function getOwner(): Owner | null {
  return convertOwner(Root.currentRoot);
}

export function createOwner(parent: Owner | null = getOwner()): Owner {
  const [root, cleanup] = Root.create(convertOwner(parent));
  const owner = convertOwner(root);
  if (parent) {
    onDetach(cleanup.detach, parent);
    onCleanup(cleanup, parent);
  }
  else {
    // No parent, never cleaned
    cleanup.detach();
  }
  return owner;
}

export function createControlledOwner(parent: Owner | null = getOwner()): [owner: Owner, cleanup: OwnerCleanup] {
  const [root, cleanup] = Root.create(convertOwner(parent));
  const owner = convertOwner(root);
  if (parent) {
    const unsubCleanup = onCleanup(cleanup, parent);
    onCleanup(unsubCleanup, owner);
    onDetach(unsubCleanup, owner);
  }
  return [owner, cleanup];
}

export function enterOwner<A extends any[], T>(root: Owner, cb: (...args: A) => T, ...args: A): T {
  return convertOwner(root).enter(cb, ...args);
}

export function onCleanup(cb: () => void, inOwner?: Owner): () => void {
  const currentOwner = inOwner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onCleanup with an owner");
  }
  return convertOwner(currentOwner).on(RootState.Cleaned, cb);
}

export function onDetach(cb: () => void, inOwner?: Owner): () => void {
  const currentOwner = inOwner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onDetach with an owner");
  }
  return convertOwner(currentOwner).on(RootState.Detached, cb);
}
