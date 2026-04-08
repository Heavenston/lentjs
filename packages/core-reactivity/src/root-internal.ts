import { defineSerialization, register } from "@lentjs/core-serialize";
import { assert, noop, remove } from "@lentjs/utils";
import type { TaskCallback } from "./task";
import type { CapturedReactivityData } from "./reaction";

const rootcleanupDataSymbol = Symbol("rootCleanupData");
type RootCleanupData = {
  root: Root,
  cleanupWithParent: boolean,
  detachWithParent: boolean,
};
export type RootCleanup = {
  (): void;
  detach(): void,
  /**
   * Register this root cleanup to be called when the given root gets cleaned.
   * This is maintained across serialization.
   */
  cleanupWithParent(): void,
  /**
   * Register this root detach to be called when the given root gets detached.
   * This is maintained across serialization.
   */
  detachWithParent(): void,
  [rootcleanupDataSymbol]: RootCleanupData,
};

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

type ReducedRoot = {
  state: RootState,
  parent: Root | null,
};
export type RootCaptureTaskData = {
  root: Root,
  task: TaskCallback,
  capture(): CapturedReactivityData,
};
export type RootCaptureData = {
  tasks: RootCaptureTaskData[],
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

  #state: RootState;
  readonly #callbacks: Readonly<Record<RootState.Cleaned | RootState.Detached, (() => void)[]>> = {
    [RootState.Cleaned]: [],
    [RootState.Detached]: [],
  };

  readonly creationStackTrace = new Error();
  readonly parent: Root | null;
  /**
   * If present this stores created tasks.
   * This is inherited from the parent, and only created for roots without a parent.
   */
  readonly captureData?: RootCaptureData;

  public get state(): RootState {
    return this.#state;
  }

  public get cleaned(): boolean {
    return this.#state === RootState.Cleaned;
  }

  public get detached(): boolean {
    return this.#state === RootState.Detached;
  }

  private constructor(state: RootState, parent: Root | null, captureData: RootCaptureData | null | undefined) {
    this.parent = parent;
    this.#state = state;
    if (captureData != null)
      this.captureData = captureData;
    defineSerialization(this, Root.reducer, Root.reviver);
  }

  private static reducer(root: Root): ReducedRoot {
    return {
      state: root.state,
      parent: root.parent,
    };
  }
  private static reviver(reduced: ReducedRoot): Root {
    return new Root(reduced.state, reduced.parent, null);
  }
  static { register(this.reviver, "__lentjs_rootReviver") }

  private static cleanupReducer(cleanup: RootCleanup): RootCleanupData  {
    return cleanup[rootcleanupDataSymbol];
  }
  private static cleaunpReviver(data: RootCleanupData): RootCleanup {
    const cleanup = data.root.#createCleanup();
    if (data.cleanupWithParent)
      cleanup.cleanupWithParent();
    if (data.detachWithParent)
      cleanup.detachWithParent();
    return cleanup;
  }
  static { register(this.cleaunpReviver, "__lentjs_rootCleanupReviver"); }

  public static create(parent: Root | null, capturing: boolean): [root: Root, cleanup: RootCleanup] {
    assert(!capturing || parent === null, "Capturing roots must have no parent");
    const root = new Root(RootState.Live, parent, capturing ? { tasks: [] } : parent?.captureData);
    return [root, root.#createCleanup()];
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

  #createCleanup(): RootCleanup {
    const root = this;
    const data: RootCleanupData = { root, cleanupWithParent: false, detachWithParent: false };

    const cleanup: RootCleanup = () => root.#switchTo(RootState.Cleaned);
    cleanup[rootcleanupDataSymbol] = data;
    cleanup.detach = () => this.#switchTo(RootState.Detached);
    cleanup.detachWithParent = () => {
      if (data.detachWithParent) {
        console.warn("Called detachWithParent multiple times");
        return;
      }
      if (!root.parent) {
        console.warn("Called detachWithParent but has no parent");
        return;
      }
      data.detachWithParent = true;
      const unsub = root.parent.on(RootState.Detached, cleanup.detach);
      root.on(RootState.Detached, unsub);
      root.on(RootState.Cleaned, unsub);
    };
    cleanup.cleanupWithParent = () => {
      if (data.cleanupWithParent) {
        console.warn("Called cleanupWithParent multiple times");
        return;
      }
      if (!root.parent) {
        console.warn("Called cleanupWithParent but has no parent");
        return;
      }
      data.cleanupWithParent = true;
      const unsub = root.parent.on(RootState.Cleaned, cleanup);
      root.on(RootState.Detached, unsub);
      root.on(RootState.Cleaned, unsub);
    };
    defineSerialization(cleanup, Root.cleanupReducer, Root.cleaunpReviver);

    Root.#cleanupLeakDetector.register(cleanup, root);
    return cleanup;
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
