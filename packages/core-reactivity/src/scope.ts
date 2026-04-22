import { defineSerialization, register } from "@lentjs/core-serialize";
import { noop, remove } from "@lentjs/utils";

export type ScopeState = "alive" | "detached" | "cleaned";
export type FinalScopeStates = Exclude<ScopeState, "alive">;
export type ScopeUnsubscribe = () => void;
declare const ContextIdSymbol: unique symbol;
/**
 * Opaque type representing the id for a context value
 */
export type ContextId<T> = { [ContextIdSymbol]: T };

export type ScopeCleanup = {
  scope: Scope;
  (): void;
  detach(): void;
};

export function createContextId<T>(id: string, cfg?: { noSerialize?: boolean }): ContextId<T> {
  if (cfg?.noSerialize)
    // @ts-ignore Fake convertion
    return Symbol(id);
  // @ts-ignore Fake convertion
  return id;
}

type ReducedScope = {
  parent: Scope | null,
  state: ScopeState,
  detachingWithParent?: boolean,
  contextValues: Map<unknown, unknown>,
};

export class Scope {
  static #currentScope: Scope | null = null;

  private static reducer(scope: Scope): ReducedScope {
    return {
      parent: scope.parent,
      state: scope.state,
      detachingWithParent: scope.#detachingWithParent,
      contextValues: new Map([...scope.#contextValues.entries()].filter(([k]) => typeof k !== "symbol")),
    };
  }

  private static reviver(reduced: ReducedScope): Scope {
    return new Scope(reduced);
  }
  static { register(Scope.reviver, "__lentjs_scope.reviver") }

  private static cleanupReducer(cleanup: ScopeCleanup): Scope {
    return cleanup.scope;
  }
  private static cleanupReviver(scope: Scope): ScopeCleanup {
    return scope.#createCleanup();
  }
  static { register(Scope.cleanupReviver, "__lentjs_scope.cleanupReviver") }

  public static get currentScope(): Scope | null {
    return Scope.#currentScope;
  }

  public static create(parent: Scope | null = Scope.currentScope): Scope {
    const scope = new Scope(parent);
    if (parent) {
      scope.#cleanupWithParent();
      scope.#detachWithParent();
    }
    else {
      scope.#setState("detached");
    }
    return scope;
  }

  public static createControlled(parent: Scope | null = Scope.currentScope): [scope: Scope, cleanup: ScopeCleanup] {
    const scope = new Scope(parent);
    if (parent)
      scope.#cleanupWithParent();
    return [scope, scope.#createCleanup()];
  }

  public static enter<T, A extends any[]>(scope: Scope | null, cb: (...args: A) => T, ...args: A): T {
    if (scope?.state === "cleaned") {
      console.warn("Should not enter a cleaned scope");
    }
    const prev = Scope.#currentScope;
    Scope.#currentScope = scope;
    try {
      return cb(...args);
    }
    catch(e) {
      throw e;
    }
    finally {
      Scope.#currentScope = prev;
    }
  }

  #state: ScopeState = "alive";
  #controller: AbortController | null = null;
  #detachingWithParent: boolean = false;
  #contextValues: Map<unknown, unknown> = new Map;
  readonly #callbacks: Record<FinalScopeStates, (() => void)[]> = {
    cleaned: [],
    detached: [],
  };
  public readonly parent: Scope | null;

  public get state(): ScopeState {
    return this.#state;
  }

  public get cleaned(): boolean {
    return this.state === "cleaned";
  }

  public get root(): Scope {
    let current: Scope = this;
    while (current.parent !== null)
      current = current.parent;
    return current;
  }

  public get signal(): AbortSignal {
    if (this.#controller === null) {
      this.#controller = new AbortController();
      if (this.#state === "cleaned")
        this.#controller.abort();
    }
    return this.#controller.signal;
  }

  private constructor(parentOrReduced: Scope | ReducedScope | null) {
    if (parentOrReduced instanceof Scope || parentOrReduced === null)  {
      this.parent = parentOrReduced;
    }
    else {
      this.parent = parentOrReduced.parent;
      this.#state = parentOrReduced.state;
      this.#contextValues = parentOrReduced.contextValues;
      if (this.parent) {
        this.#cleanupWithParent();
        if (parentOrReduced.detachingWithParent)
          this.#detachWithParent();
      }
    }
    defineSerialization(this, Scope.reducer, Scope.reviver);
  }

  #createCleanup(): ScopeCleanup {
    const cleanup: ScopeCleanup = () => {
      this.#setState("cleaned");
    };
    cleanup.scope = this;
    cleanup.detach = () => {
      this.#setState("detached");
    };
    defineSerialization(cleanup, Scope.cleanupReducer, Scope.cleanupReviver);
    return cleanup;
  }

  /**
   * Only place where this.#state is changed
   */
  #setState(newState: FinalScopeStates) {
    if (this.state !== "alive") {
      return;
    }

    this.enter(() => {
      this.#state = newState;
      if (newState === "cleaned")
        this.#controller?.abort();
      this.#callbacks[newState].splice(0).forEach(cb => cb());
      // Remove the other callbacks, they are not needed anymore
      this.#callbacks[newState === "cleaned" ? "detached" : "cleaned"].splice(0);
    });
  }

  #cleanupWithParent() {
    const parent = this.parent!;
    const unsub = parent.on("cleaned", () => this.#setState("cleaned"));
    this.on("cleaned", unsub);
    this.on("detached", unsub);
  }

  #detachWithParent() {
    this.#detachingWithParent = true;
    const parent = this.parent!;
    const unsub = parent.on("detached", () => this.#setState("detached"));
    this.on("cleaned", unsub);
    this.on("detached", unsub);
  }

  public enter<T, A extends any[]>(cb: (...args: A) => T, ...args: A): T {
    return Scope.enter(this, cb, ...args);
  }

  public on(state: FinalScopeStates, cb: () => void): ScopeUnsubscribe {
    if (this.state === state) {
      cb();
      return noop;
    }
    if (this.state !== "alive") {
      return noop;
    }
    this.#callbacks[state].push(cb);
    return () => {
      remove(this.#callbacks[state], cb);
    };
  }

  public onCleanup(cb: () => void): ScopeUnsubscribe {
    return this.on("cleaned", cb);
  }

  public onDetach(cb: () => void): ScopeUnsubscribe {
    return this.on("detached", cb);
  }

  public hasContext<T>(id: ContextId<T>): boolean {
    return this.#contextValues.has(id);
  }

  public getContext<T>(id: ContextId<T>): T {
    if (!this.#contextValues.has(id)) {
      if (this.parent === null)
        throw new Error(`No context value found for id '${id}'`);
      return this.parent.getContext(id);
    }
    return this.#contextValues.get(id) as T;
  }

  public tryGetContext<T>(id: ContextId<T>): T | null {
    if (!this.#contextValues.has(id)) {
      if (this.parent === null)
        return null;
      return this.parent.tryGetContext(id);
    }
    return this.#contextValues.get(id) as T;
  }

  public setContext<T>(id: ContextId<T>, value: T): void {
    this.#contextValues.set(id, value);
  }
}

export function getScope(): Scope {
  const scope = Scope.currentScope;
  if (scope === null)
    throw new Error("getScope: No current scope");
  return scope;
}
