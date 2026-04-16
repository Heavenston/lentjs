import { defineSerialization, register } from "@lentjs/core-serialize";
import { noop, remove } from "@lentjs/utils";

export type ScopeState = "alive" | "detached" | "cleaned";
export type FinalScopeStates = Exclude<ScopeState, "alive">;
export type ScopeUnsubscribe = () => void;
declare const ContextKeySymbol: unique symbol;
/**
 * Opaque type representing the key for a context value
 */
export type ContextKey<T> = { [ContextKeySymbol]: T };

export type ScopeCleanup = {
  scope: Scope;
  (): void;
  detach(): void;
};

export function createContextKey<T>(id: string, cfg?: { noSerialize?: boolean }): ContextKey<T> {
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
      contextValues: new Map(scope.#contextValues.entries().filter(([k]) => typeof k !== "symbol")),
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

  public get root(): Scope {
    let current: Scope = this;
    while (current.parent !== null)
      current = current.parent;
    return current;
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

  #setState(newState: FinalScopeStates) {
    if (this.state !== "alive") {
      if (this.state !== newState) {
        console.warn(`Scope in state ${this.state} cannot switch to ${newState}`);
      }
      return;
    }

    this.enter(() => {
      this.#state = newState;
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
      console.warn(`Cannot listen for scope state ${state} from state ${this.state}`);
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

  public hasContext<T>(key: ContextKey<T>): boolean {
    return this.#contextValues.has(key);
  }

  public getContext<T>(key: ContextKey<T>): T {
    if (!this.#contextValues.has(key)) {
      if (this.parent === null)
        throw new Error(`No context value found for key ${key}`);
      return this.parent.getContext(key);
    }
    return this.#contextValues.get(key) as T;
  }

  public tryGetContext<T>(key: ContextKey<T>): T | null {
    if (!this.#contextValues.has(key)) {
      if (this.parent === null)
        return null;
      return this.parent.tryGetContext(key);
    }
    return this.#contextValues.get(key) as T;
  }

  public setContext<T>(key: ContextKey<T>, value: T) {
    this.#contextValues.set(key, value);
  }
}

export function getScope(): Scope {
  const scope = Scope.currentScope;
  if (scope === null)
    throw new Error("getScope: No current scope");
  return scope;
}
