import { assert } from "@lentjs/utils";
import type { CapturedTaskData } from "./task";

export type RootCleanup = (() => void) & { detach(): void };

export const enum RootState {
  Live = "live",
  Detached = "detached",
  Cleaned = "cleaned",
}

export type TaskCaptureData = {
  cb: CapturedTaskData[0],
  capture: () => CapturedTaskData[1],
};
export type Root = {
  state: RootState,
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
  switch (this.state) {
  case RootState.Detached:
  case RootState.Cleaned:
    console.warn(`Cannot clean a ${this.state} root`);
    return;
  }
  this.state = RootState.Cleaned;
  this.cleanupCallbacks.splice(0).forEach(cb => cb());
}

function rootDetach(this: Root) {
  switch (this.state) {
  case RootState.Detached:
  case RootState.Cleaned:
    console.warn(`Cannot detach a ${this.state} root`);
    return;
  }
  this.state = RootState.Detached;
  // Not needed anymore
  this.cleanupCallbacks.splice(0);
}

export function getCurrentRoot(): Root | null {
  return currentRoot;
}

/**
 * This is a development helper for detecting root leaks
 */
const cleanupLeakDetector = new FinalizationRegistry((root: Root) => {
  if (root.state !== RootState.Cleaned) {
    if (root.state === RootState.Detached)
      console.log("Detached cleanup gced");
    else
      console.warn("Leaked cleanup of root created at", root.creationStackTrace);
  }
});

export function createRoot(extend: Partial<Root> = {}): [root: Root, cleanup: RootCleanup] {
  const root: Root = {
    state: RootState.Live,
    creationStackTrace: new Error(),
    parent: getCurrentRoot(),
    cleanupCallbacks: [],
    ...extend,
  };

  const cleanup = rootCleanup.bind(root) as RootCleanup;
  cleanup.detach = rootDetach.bind(root);

  cleanupLeakDetector.register(cleanup, root);
  return [root, cleanup];
}

export function enterRoot<A extends any[], T>(root: Root, cb: (...args: A) => T, ...args: A): T {
  assert(root.state !== RootState.Cleaned, "Cannot enter an already cleaned root");
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
