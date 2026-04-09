import { defineSerialization, register } from "@lentjs/core-serialize";
import { assert, createUid, noop, remove } from "@lentjs/utils";
import type { TaskCallback } from "./task";
import type { CapturedReactivityData } from "./reaction";

export type RootCleanup = {
  (): void;
  detach(): void,
  root: Root,
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
  id: string,
  state: RootState,
  parent: Root | null,
  cleanupWithParent: boolean,
  detachWithParent: boolean,
  contextValues: Map<unknown, unknown>,
};
export type RootCaptureTaskData = {
  root: Root,
  task: TaskCallback,
  capture(): CapturedReactivityData,
};
export type RootCaptureData = {
  tasks: RootCaptureTaskData[],
};

type RootConstructorConfig = {
  id?: string,
  state: RootState,
  parent: Root | null,
  cleanupWithParent?: boolean,
  detachWithParent?: boolean,
  captureData?: RootCaptureData,
  contextValues?: Map<unknown, unknown>,
};
export type CreateRootConfig = {
  parent?: null,
  capturing?: boolean,
  startDetached?: boolean,
} | {
  parent: Root,
  cleanupWithParent?: boolean,
  detachWithParent?: boolean,
  startDetached?: false,
} | {
  parent: Root,
  cleanupWithParent?: false,
  detachWithParent?: false,
  startDetached: true,
};

export class Root {
  static #currentRoot: Root | null = null;

  public static get currentRoot() {
    return this.#currentRoot;
  }

  readonly #id;
  #state: RootState;
  readonly #callbacks: Readonly<Record<RootState.Cleaned | RootState.Detached, (() => void)[]>> = {
    [RootState.Cleaned]: [],
    [RootState.Detached]: [],
  };

  public readonly creationStackTrace = new Error();
  public readonly parent: Root | null;

  private readonly cleanupWithParent: boolean = false;
  private readonly detachWithParent: boolean = false;

  /**
   * If present this stores created tasks.
   * This is inherited from the parent, and only created for roots without a parent.
   */
  public readonly captureData?: RootCaptureData;
  public readonly contextValues: Map<unknown, unknown>;

  public get state(): RootState {
    return this.#state;
  }

  public get cleaned(): boolean {
    return this.#state === RootState.Cleaned;
  }

  public get detached(): boolean {
    return this.#state === RootState.Detached;
  }

  private constructor(config: RootConstructorConfig) {
    this.#id = config.id ?? createUid();
    this.parent = config.parent;
    this.#state = config.state;
    this.contextValues = config.contextValues ?? new Map;
    if (config.captureData != null)
      this.captureData = config.captureData;
    defineSerialization(this, Root.reducer, Root.reviver);

    if (config.cleanupWithParent) {
      const parent = this.parent!;
      this.cleanupWithParent = true;
      const unsub = parent.on(RootState.Cleaned, () => this.#switchTo(RootState.Cleaned));
      this.on(RootState.Cleaned, unsub);
      this.on(RootState.Detached, unsub);
    }
    if (config.detachWithParent) {
      const parent = this.parent!;
      this.detachWithParent = true;
      const unsub = parent.on(RootState.Detached, () => this.#switchTo(RootState.Detached));
      this.on(RootState.Cleaned, unsub);
      this.on(RootState.Detached, unsub);
    }
  }

  public toString(): string {
    const t = `${this.#id}(${this.state})`;
    if (this.parent)
      return `${this.parent.toString()}${this.detachWithParent ? "-->" : "-/>"}${t}`;
    return t;
  }

  private static reducer(root: Root): ReducedRoot {
    return {
      id: root.#id,
      state: root.state,
      parent: root.parent,
      cleanupWithParent: root.cleanupWithParent,
      detachWithParent: root.detachWithParent,
      contextValues: root.contextValues,
    };
  }
  private static reviver(reduced: ReducedRoot): Root {
    return new Root({
      id: reduced.id,
      state: reduced.state,
      parent: reduced.parent,
      cleanupWithParent: reduced.cleanupWithParent,
      detachWithParent: reduced.detachWithParent,
      contextValues: reduced.contextValues,
    });
  }
  static { register(this.reviver, "__lentjs_rootReviver") }

  private static cleanupReducer(cleanup: RootCleanup): Root  {
    return cleanup.root;
  }
  private static cleaunpReviver(root: Root): RootCleanup {
    return root.createCleanup();
  }
  static { register(this.cleaunpReviver, "__lentjs_rootCleanupReviver"); }

  public static create(config: CreateRootConfig): Root {
    let root: Root;
    if (config.parent) {
      root = new Root({
        state: config.startDetached ? RootState.Detached : RootState.Live,
        parent: config.parent,
        cleanupWithParent: config.cleanupWithParent ?? false,
        detachWithParent: config.detachWithParent ?? false,
        captureData: config.parent.captureData,
      });
    }
    else {
      root = new Root({
        state: config.startDetached ? RootState.Detached : RootState.Live,
        parent: null,
        captureData: config.capturing ? { tasks: [] } : undefined,
      });
    }
    return root;
  }

  #switchTo(newState: RootState.Cleaned | RootState.Detached): void {
    if (this.#state !== RootState.Live) {
      if (this.#state !== newState)
        console.warn(`Cannot switch to ${newState} from ${this.#state}`);
      return;
    }
    this.#state = newState;
    this.enter(() => {
      // Needs to splice before calling because the array *may* be modified during iteration
      this.#callbacks[newState].splice(0).forEach(cb => cb());
    });
    // Avoid leaking now useless callbacks
    this.#callbacks[newState === RootState.Cleaned ? RootState.Detached : RootState.Cleaned].splice(0);
  }

  public enter<A extends any[], T>(cb: (...args: A) => T, ...args: A): T {
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

  public createCleanup(): RootCleanup {
    const cleanup: RootCleanup = () => this.#switchTo(RootState.Cleaned);
    cleanup.detach = () => this.#switchTo(RootState.Detached);
    cleanup.root = this;
    defineSerialization(cleanup, Root.cleanupReducer, Root.cleaunpReviver);
    return cleanup;
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
    const unsub = () => remove(this.#callbacks[state], cb);
    return unsub;
  }
}
