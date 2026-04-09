export type { Owner } from "./owner-internal";

import { register } from "@lentjs/core-serialize";
import { convertOwner, type Owner } from "./owner-internal";
import type { CapturedReactivityData } from "./reaction";
import { Root, RootState } from "./root-internal";
import type { TaskCallback } from "./task";
import { assert } from "@lentjs/utils";

export type OwnerCleanup = {
  (): void;
  detach(): void,
};

export type CapturedOwnerTaskData = {
  owner: Owner,
  task: TaskCallback,
  reactivityData: CapturedReactivityData,
};
export type CapturedOwnerData = {
  tasks: CapturedOwnerTaskData[],
};
export type OwnerCapture = () => CapturedOwnerData;

export function getOwner(): Owner | null {
  return convertOwner(Root.currentRoot);
}

export function createOwner(parent: Owner | null = getOwner()): Owner {
  return convertOwner(Root.create(parent ? {
    parent: convertOwner(parent),
    cleanupWithParent: true,
    detachWithParent: true,
  } : {
    startDetached: true,
  }));
}

export function createControlledOwner(parent: Owner | null = getOwner()): [owner: Owner, cleanup: OwnerCleanup] {
  const root = Root.create(parent ? {
    parent: convertOwner(parent),
    cleanupWithParent: true,
  } : { });
  return [convertOwner(root), root.createCleanup()];
}

export function createCapturingOwner(): [owner: Owner, clean: OwnerCleanup, capture: OwnerCapture] {
  const root = Root.create({
    capturing: true,
  });
  return [convertOwner(root), root.createCleanup(), () => {
    const data = {
      tasks: root.captureData!.tasks.map(({ capture, root, task }) => ({
        owner: convertOwner(root),
        task,
        reactivityData: capture(),
      })),
    };
    return data;
  }]
}

export function enterOwner<A extends any[], T>(root: Owner, cb: (...args: A) => T, ...args: A): T {
  assert(!root.cleaned, "Cannot enter a cleaned owner");
  return convertOwner(root).enter(cb, ...args);
}

export function onCleanup(cb: () => void, inOwner?: Owner): () => void {
  const currentOwner = inOwner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onCleanup with an owner");
  }
  return convertOwner(currentOwner).on(RootState.Cleaned, cb);
}
register(onCleanup, "__lentjs_onCleanup");

export function onDetach(cb: () => void, inOwner?: Owner): () => void {
  const currentOwner = inOwner ?? getOwner();
  if (currentOwner === null) {
    throw new Error("Can only call onDetach with an owner");
  }
  return convertOwner(currentOwner).on(RootState.Detached, cb);
}
register(onDetach, "__lentjs_onDetach");
