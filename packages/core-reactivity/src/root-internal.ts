import { assert } from "@lentjs/utils";
import type { CapturedTaskData } from "./task";

export type RootCleanup = (() => void) & { detach(): void };

export type TaskCaptureData = {
  cb: CapturedTaskData[0],
  capture: () => CapturedTaskData[1],
};
export type Root = {
  cleaned: boolean,
  detached: boolean,
  readonly creationStackTrace: Error,
  readonly parent: Root | null,
  readonly cleanupCallbacks: (() => void)[],
  /**
   * If present, tasks are captured into this list
   */
  readonly tasks?: TaskCaptureData[],
};

let currentRoot: Root | null = null;

function rootCleanup(this: Root) {
  if (this.detached) {
    console.warn("Attempted to clean a detached root");
    return;
  }
  if (this.cleaned) return;
  this.cleaned = true;
  this.cleanupCallbacks.splice(0).forEach(cb => cb());
}

export function getCurrentRoot(): Root | null {
  return currentRoot;
}

const cleanupLeakDetector = new FinalizationRegistry((root: Root) => {
  if (!root.cleaned && !root.detached) {
    if (root.detached)
      console.log("Datached cleanup gced");
    else
      console.warn("Leaked cleanup of root created at", root.creationStackTrace);
  }
});

export function createRoot(extend: Partial<Root> = {}): [root: Root, cleanup: RootCleanup] {
  const root: Root = {
    creationStackTrace: new Error(),
    detached: false,
    cleaned: false,
    parent: getCurrentRoot(),
    cleanupCallbacks: [],
    ...extend,
  };

  const cleanup = rootCleanup.bind(root) as RootCleanup;
  cleanup.detach = () => {
    if (root.cleaned) {
      console.warn("Attempted to detach an already cleaned root");
      return;
    }
    root.detached = true;
  };

  cleanupLeakDetector.register(cleanup, root);
  return [root, cleanup];
}

export function enterRoot<A extends any[], T>(root: Root, cb: (...args: A) => T, ...args: A): T {
  assert(!root.cleaned, "Cannot enter an already cleaned root");
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
