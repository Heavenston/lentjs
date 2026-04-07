import { assert, noop, remove } from "@lentjs/utils";
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
    if (root.state === RootState.Live) {
      console.warn("Leaked cleanup of root created at", root.creationStackTrace);
    }
  });

  #state: RootState = RootState.Live;
  readonly #callbacks: Readonly<Record<RootState.Cleaned | RootState.Detached, (() => void)[]>> = {
    [RootState.Cleaned]: [],
    [RootState.Detached]: [],
  };

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
    const cleanup = root.#switchTo.bind(root, RootState.Cleaned) as RootCleanup;
    cleanup.detach = root.#switchTo.bind(root, RootState.Detached);
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

  #switchTo(newState: RootState.Cleaned | RootState.Detached): void {
    if (this.#state !== RootState.Live) {
      if (this.#state !== newState)
        console.warn(`Cannot switch to ${newState} from ${this.#state}`);
      return;
    }
    this.#state = newState;
    this.#callbacks[newState].forEach(cb => cb());
    this.#callbacks[RootState.Cleaned].splice(0);
    this.#callbacks[RootState.Detached].splice(0);
  }

  public on(state: RootState.Cleaned | RootState.Detached, cb: () => void): () => void {
    if (this.#state !== RootState.Live) {
      if (this.#state === state) {
        cb();
        return noop;
      }
      else {
        return noop;
      }
    }
    this.#callbacks[state].push(cb);
    return () => {
      remove(this.#callbacks[state], cb);
    };
  }
}
