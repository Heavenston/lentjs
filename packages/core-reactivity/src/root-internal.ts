import { defineSerialization, register } from "@lentjs/core-serialize";
import { assert, noop, remove } from "@lentjs/utils";

export type RootCleanup = (() => void) & { detach(): void, root: Root };

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

  public get state(): RootState {
    return this.#state;
  }

  public get cleaned(): boolean {
    return this.#state === RootState.Cleaned;
  }

  public get detached(): boolean {
    return this.#state === RootState.Detached;
  }

  private constructor(state: RootState, parent: Root | null) {
    this.parent = parent;
    this.#state = state;
  }

  private static reducer(root: Root): ReducedRoot {
    return {
      state: root.state,
      parent: root.parent,
    };
  }
  private static reviver(reduced: ReducedRoot): Root {
    return new Root(reduced.state, reduced.parent);
  }
  static { register(this.reviver, "__lentjs_rootReviver") }

  private static cleanupReducer(cleanup: RootCleanup): Root {
    return cleanup.root;
  }
  private static cleaunpReviver(root: Root): RootCleanup {
    const cleanup = root.#switchTo.bind(root, RootState.Cleaned) as RootCleanup;
    cleanup.root = root;
    cleanup.detach = root.#switchTo.bind(root, RootState.Detached);
    Root.#cleanupLeakDetector.register(cleanup, root);
    defineSerialization(cleanup, Root.cleanupReducer, Root.cleaunpReviver);
    return cleanup;
  }
  static { register(this.cleaunpReviver, "__lentjs_rootCleanupReviver"); }

  public static create(parent: Root | null): [root: Root, cleanup: RootCleanup] {
    const root = new Root(RootState.Live, parent);
    defineSerialization(root, Root.reducer, Root.reviver);
    const cleanup = Root.cleaunpReviver(root);
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
