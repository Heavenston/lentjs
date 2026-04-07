import { assert, noop, remove, unreachable } from "@lentjs/utils";
import type { CapturedTaskData } from "./task";

export type RootCleanup = (() => void) & { detach(): void };

export const enum RootState {
  /**
   * State after creation.
   * Can change to Detached or Cleaned.
   */
  Live = "live",
  /**
   * Set when the detach function is called.
   * Final state, cannot change after that.
   */
  Detached = "detached",
  /**
   * Set when the cleanup function is called, before calling the cleanup callbacks.
   * Final state, cannot change after that.
   */
  Cleaned = "cleaned",
}

export type TaskCaptureData = {
  cb: CapturedTaskData[0],
  capture: () => CapturedTaskData[1],
};

export class Root {
  static #currentRoot: Root | null = null;
  /**
   * This is a development helper for detecting root leaks
   */
  static #cleanupLeakDetector = new FinalizationRegistry((root: Root) => {
    if (root.state !== RootState.Cleaned) {
      if (root.state === RootState.Detached)
        console.log("Detached cleanup gced");
      else
        console.warn("Leaked cleanup of root created at", root.creationStackTrace);
    }
  });

  #state: RootState = RootState.Live;
  readonly #cleanupCallbacks: (() => void)[] = [];

  readonly creationStackTrace = new Error();
  readonly parent: Root | null;
  /**
   * If present, tasks are captured into this list
   */
  readonly tasks?: TaskCaptureData[];

  public get state(): RootState {
    return this.#state;
  }

  public get cleaned(): boolean {
    return this.#state === RootState.Cleaned;
  }

  public get detached(): boolean {
    return this.#state === RootState.Detached;
  }

  private constructor(parent: Root | null, capturing: boolean) {
    this.parent = parent;
    if (capturing)
      this.tasks = [];
  }

  public static create(parent: Root | null, capturing: boolean): [root: Root, cleanup: RootCleanup] {
    const root = new Root(parent, capturing);
    const cleanup = root.#clean.bind(root) as RootCleanup;
    cleanup.detach = root.#detach.bind(root);
    Root.#cleanupLeakDetector.register(cleanup, root);
    return [root, cleanup];
  }

  public static get currentRoot() {
    return this.#currentRoot;
  }

  public enter<A extends any[], T>(cb: (...args: A) => T, ...args: A): T {
    assert(this.state !== RootState.Cleaned, "Cannot enter an already cleaned root");
    const prev = Root.#currentRoot;
    Root.#currentRoot = this;
    try {
      return cb(...args);
    }
    catch(e) {
      throw e;
    }
    finally {
      Root.#currentRoot = prev;
    }
  }

  #clean() {
    switch (this.#state) {
    case RootState.Detached:
      console.warn(`Cannot clean a ${this.state} root`);
    case RootState.Cleaned:
      return;
    case RootState.Live:
      break;
    default: unreachable(this.#state);
    }
    this.#state = RootState.Cleaned;
    this.#cleanupCallbacks.splice(0).forEach(cb => cb());
  }

  #detach(this: Root) {
    switch (this.#state) {
    case RootState.Detached:
    case RootState.Cleaned:
      console.warn(`Cannot detach a ${this.state} root`);
      return;
    case RootState.Live:
      break;
    default: unreachable(this.#state);
    }
    this.#state = RootState.Detached;
    this.#cleanupCallbacks.splice(0);
  }

  public onCleanup(cb: () => void): () => void {
    switch (this.#state) {
    case RootState.Live:
      this.#cleanupCallbacks.push(cb);
      return () => {
        if (this.#state === RootState.Live)
          remove(this.#cleanupCallbacks, cb);
      };
    case RootState.Detached:
      // We do not bother to store the callback, it will never be called
      return noop;
    case RootState.Cleaned:
      cb();
      return noop;
    default: unreachable(this.#state);
    }
  }
}
