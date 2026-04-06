import { remove } from "@lentjs/utils";
import type { CapturedTaskData } from "./task";

export type TaskCaptureData = {
  cb: CapturedTaskData[0],
  capture: () => CapturedTaskData[1],
};
export type Root = {
  cleaned: boolean,
  readonly parent: Root | null,
  readonly cleanupCallbacks: (() => void)[],
  /**
   * If present, tasks are captured into this list
   */
  readonly tasks?: TaskCaptureData[],
};

let currentRoot: Root | null = null;

function rootCleanup(this: Root) {
  if (this.cleaned) return;
  this.cleaned = true;
  this.cleanupCallbacks.splice(0).forEach(cb => cb());
}

function createRootCleanup(root: Root): (() => void) {
  const parent = root.parent;
  const cleanup = rootCleanup.bind(root);
  if (parent) {
    parent.cleanupCallbacks.push(cleanup);
    root.cleanupCallbacks.push(() => remove(parent.cleanupCallbacks, cleanup));
  }
  return cleanup;
}

export function getCurrentRoot(): Root | null {
  return currentRoot;
}

export function createRoot(extend: Partial<Root> = {}): [root: Root, cleanup: () => void] {
  const root: Root = {
    cleaned: false,
    parent: getCurrentRoot(),
    cleanupCallbacks: [],
    ...extend,
  };
  const cleanup = createRootCleanup(root);
  return [root, cleanup];
}

export function enterRoot<A extends any[], T>(root: Root, cb: (...args: A) => T, ...args: A): T {
  const prev = currentRoot;
  currentRoot = root;
  try {
    return cb(...args);
  }
  catch(e) {
    throw e;
  }
  finally {
    currentRoot = prev;
  }
}
