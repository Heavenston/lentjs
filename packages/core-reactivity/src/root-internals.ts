import { assert } from "@lentjs/utils";
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

export function rootCleanup(this: Root) {
  assert(!this.cleaned, "Cannot call cleanup() on a root multiple times");
  this.cleaned = true;
  this.cleanupCallbacks.forEach(cb => cb());
}

let currentRoot: Root | null = null;

export function getCurrentRoot(): Root | null {
  return currentRoot;
}

export function runWithRoot<A extends any[], T>(root: Root, cb: (...args: A) => T, ...args: A): T {
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
