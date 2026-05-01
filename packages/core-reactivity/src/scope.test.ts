import { describe, expect, test, jest } from "bun:test";
import { createContextId, getScope, Scope } from "./scope";

describe("Scope.currentScope", () => {
  test("starts as null", () => {
    expect(Scope.currentScope).toBeNull();
  });
});

describe("getScope", () => {
  test("throws outside a scope", () => {
    expect(() => {
      getScope();
    }).toThrow("getScope: No current scope");
  });

  test("returns current scope inside Scope.enter", () => {
    const scope = Scope.create();
    expect.assertions(1);
    Scope.enter(scope, () => {
      expect(getScope()).toBe(scope);
    });
  });

  test("throws again after Scope.enter exits", () => {
    const scope = Scope.create();
    Scope.enter(scope, () => {});
    expect(() => getScope()).toThrow("getScope: No current scope");
  });
});

describe("Scope.create", () => {
  test("no parent", () => {
    const scope = Scope.create();
    expect(scope.parent).toBeNull();
    expect(scope.state).toBe("detached");
    expect(scope.cleaned).toBeFalse();
    expect(scope.root).toBe(scope);
  });

  test("with parent", () => {
    const parent = Scope.create();
    const scope = Scope.create(parent);
    expect(scope.parent).toBe(parent);
    expect(scope.state).toBe("detached");
    expect(scope.cleaned).toBeFalse();
    expect(scope.root).toBe(parent);
  });

  test("defaults to Scope.currentScope when no parent given", () => {
    const [controlled, cleanup] = Scope.createControlled();
    const child = Scope.enter(controlled, () => Scope.create());
    expect(child.parent).toBe(controlled);
    cleanup();
  });

  test("explicit null parent overrides currentScope", () => {
    const [controlled, cleanup] = Scope.createControlled();
    const child = Scope.enter(controlled, () => Scope.create(null));
    expect(child.parent).toBeNull();
    cleanup();
  });

  test("child inherits alive state from alive parent", () => {
    const [parent, cleanup] = Scope.createControlled();
    const child = Scope.create(parent);
    expect(child.state).toBe("alive");
    cleanup();
  });

  test("child of detached parent is detached", () => {
    const parent = Scope.create();
    expect(parent.state).toBe("detached");
    const child = Scope.create(parent);
    expect(child.state).toBe("detached");
  });
});

describe("Scope.createControlled", () => {
  test("no parent starts alive", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect(scope.parent).toBeNull();
    expect(scope.state).toBe("alive");
    expect(scope.cleaned).toBeFalse();
    expect(scope.root).toBe(scope);
    cleanup();
  });

  test("with parent starts alive", () => {
    const [parent, parentCleanup] = Scope.createControlled();
    const [scope, cleanup] = Scope.createControlled(parent);
    expect(scope.parent).toBe(parent);
    expect(scope.state).toBe("alive");
    expect(scope.root).toBe(parent);
    cleanup();
    parentCleanup();
  });

  test("defaults to Scope.currentScope when no parent given", () => {
    const [outer, outerCleanup] = Scope.createControlled();
    const [inner, innerCleanup] = Scope.enter(outer, () => Scope.createControlled());
    expect(inner.parent).toBe(outer);
    innerCleanup();
    outerCleanup();
  });

  test("cleanup transitions to cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.state).toBe("cleaned");
    expect(scope.cleaned).toBeTrue();
  });

  test("detach transitions to detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.state).toBe("detached");
    expect(scope.cleaned).toBeFalse();
  });

  test("cleanup.scope references the scope", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect(cleanup.scope).toBe(scope);
    cleanup();
  });
});

describe("Scope.enter", () => {
  test("sets currentScope inside callback", () => {
    const scope = Scope.create();
    expect.assertions(1);
    Scope.enter(scope, () => {
      expect(Scope.currentScope).toBe(scope);
    });
  });

  test("restores currentScope after callback", () => {
    const scope = Scope.create();
    expect(Scope.currentScope).toBeNull();
    Scope.enter(scope, () => {});
    expect(Scope.currentScope).toBeNull();
  });

  test("restores currentScope after callback throws", () => {
    const scope = Scope.create();
    expect(Scope.currentScope).toBeNull();
    expect(() => {
      Scope.enter(scope, () => {
        throw new Error("boom");
      });
    }).toThrow("boom");
    expect(Scope.currentScope).toBeNull();
  });

  test("returns the callback value", () => {
    const scope = Scope.create();
    const result = Scope.enter(scope, () => 42);
    expect(result).toBe(42);
  });

  test("nested enter restores correctly", () => {
    const outer = Scope.create();
    const inner = Scope.create(outer);
    expect.assertions(3);
    Scope.enter(outer, () => {
      expect(Scope.currentScope).toBe(outer);
      Scope.enter(inner, () => {
        expect(Scope.currentScope).toBe(inner);
      });
      expect(Scope.currentScope).toBe(outer);
    });
  });

  test("enter with null scope", () => {
    const scope = Scope.create();
    Scope.enter(scope, () => {
      expect(Scope.currentScope).toBe(scope);
      Scope.enter(null, () => {
        expect(Scope.currentScope).toBeNull();
      });
      expect(Scope.currentScope).toBe(scope);
    });
  });

  test("passes arguments to callback", () => {
    const scope = Scope.create();
    const result = Scope.enter(scope, (a: number, b: string) => `${a}-${b}`, 1, "x");
    expect(result).toBe("1-x");
  });

  test("instance enter sets currentScope to the instance", () => {
    const scope = Scope.create();
    expect.assertions(1);
    scope.enter(() => {
      expect(Scope.currentScope).toBe(scope);
    });
  });

  test("instance enter passes arguments and returns value", () => {
    const scope = Scope.create();
    const result = scope.enter((a: number, b: number) => a + b, 3, 4);
    expect(result).toBe(7);
  });
});

describe("scope.root", () => {
  test("root of parentless scope is itself", () => {
    const scope = Scope.create();
    expect(scope.root).toBe(scope);
  });

  test("root of child is the parent", () => {
    const parent = Scope.create();
    const child = Scope.create(parent);
    expect(child.root).toBe(parent);
  });

  test("root traverses to the top of a deep chain", () => {
    const grandparent = Scope.create();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    expect(child.root).toBe(grandparent);
    expect(parent.root).toBe(grandparent);
  });
});

describe("scope.cleaned", () => {
  test("false when alive", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect(scope.cleaned).toBeFalse();
    cleanup();
  });

  test("true when cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.cleaned).toBeTrue();
  });

  test("false when detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.cleaned).toBeFalse();
  });

  test("false for parentless Scope.create (detached)", () => {
    const scope = Scope.create();
    expect(scope.cleaned).toBeFalse();
  });
});

describe("parent-child lifecycle propagation", () => {
  test("cleaning parent cleans alive child created with Scope.create", () => {
    const [parent, cleanup] = Scope.createControlled();
    const child = Scope.create(parent);
    expect(child.state).toBe("alive");
    cleanup();
    expect(child.state).toBe("cleaned");
    expect(child.cleaned).toBeTrue();
  });

  test("detaching parent detaches alive child created with Scope.create", () => {
    const [parent, cleanup] = Scope.createControlled();
    const child = Scope.create(parent);
    expect(child.state).toBe("alive");
    cleanup.detach();
    expect(child.state).toBe("detached");
    expect(child.cleaned).toBeFalse();
  });

  test("cleaning parent cleans controlled child", () => {
    const [parent, parentCleanup] = Scope.createControlled();
    const [child,] = Scope.createControlled(parent);
    expect(child.state).toBe("alive");
    parentCleanup();
    expect(child.state).toBe("cleaned");
  });

  test("detaching parent does not detach controlled child", () => {
    const [parent, parentCleanup] = Scope.createControlled();
    const [child, childCleanup] = Scope.createControlled(parent);
    expect(child.state).toBe("alive");
    parentCleanup.detach();
    expect(child.state).toBe("alive");
    childCleanup();
  });

  test("cleaning parent propagates to grandchild", () => {
    const [grandparent, cleanup] = Scope.createControlled();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    expect(child.state).toBe("alive");
    cleanup();
    expect(parent.state).toBe("cleaned");
    expect(child.state).toBe("cleaned");
  });

  test("detaching parent propagates to grandchild", () => {
    const [grandparent, cleanup] = Scope.createControlled();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    expect(child.state).toBe("alive");
    cleanup.detach();
    expect(parent.state).toBe("detached");
    expect(child.state).toBe("detached");
  });

  test("clean controlled with detached parent", () => {
    const parent = Scope.create();
    expect(parent.state).toBe("detached");
    const [scope, cleanup] = Scope.createControlled(parent);
    expect(scope.parent).toBe(parent);
    expect(scope.state).toBe("alive");
    cleanup();
    expect(scope.state).toBe("cleaned");
    expect(scope.cleaned).toBeTrue();
  });

  test("clean parent with already-detached child does not re-clean it", () => {
    const [parent, parentCleanup] = Scope.createControlled();
    const [child, childCleanup] = Scope.createControlled(parent);
    childCleanup.detach();
    expect(child.state).toBe("detached");
    parentCleanup();
    expect(parent.state).toBe("cleaned");
    expect(child.state).toBe("detached");
    expect(child.cleaned).toBeFalse();
  });

  test("clean parent with already-cleaned child does not error", () => {
    const [parent, parentCleanup] = Scope.createControlled();
    const [child, childCleanup] = Scope.createControlled(parent);
    childCleanup();
    expect(child.state).toBe("cleaned");
    expect(() => parentCleanup()).not.toThrow();
    expect(parent.state).toBe("cleaned");
    expect(child.state).toBe("cleaned");
  });

  test("multiple children all cleaned when parent cleans", () => {
    const [parent, cleanup] = Scope.createControlled();
    const child1 = Scope.create(parent);
    const child2 = Scope.create(parent);
    const child3 = Scope.create(parent);
    cleanup();
    expect(child1.state).toBe("cleaned");
    expect(child2.state).toBe("cleaned");
    expect(child3.state).toBe("cleaned");
  });

  test("multiple children all detached when parent detaches", () => {
    const [parent, cleanup] = Scope.createControlled();
    const child1 = Scope.create(parent);
    const child2 = Scope.create(parent);
    const child3 = Scope.create(parent);
    cleanup.detach();
    expect(child1.state).toBe("detached");
    expect(child2.state).toBe("detached");
    expect(child3.state).toBe("detached");
  });
});

describe("scope.on / onCleanup / onDetach", () => {
  test("onCleanup called one time", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onCleanup(cb);
    expect(cb).toHaveBeenCalledTimes(0);
    cleanup();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("onDetach called one time", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onDetach(cb);
    expect(cb).toHaveBeenCalledTimes(0);
    cleanup.detach();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("onCleanup not called on detach", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onCleanup(cb);
    cleanup.detach();
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("onDetach not called on cleanup", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onDetach(cb);
    cleanup();
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("onCleanup called directly if scope already cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.state).toBe("cleaned");
    const cb = jest.fn();
    scope.onCleanup(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("onDetach called directly if scope already detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.state).toBe("detached");
    const cb = jest.fn();
    scope.onDetach(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("onDetach not called directly if scope already cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.state).toBe("cleaned");
    const cb = jest.fn();
    scope.onDetach(cb);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("onCleanup not called directly if scope already detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.state).toBe("detached");
    const cb = jest.fn();
    scope.onCleanup(cb);
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("unsubscribe prevents callback", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    const unsub = scope.onCleanup(cb);
    unsub();
    cleanup();
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("unsubscribe onDetach prevents callback", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    const unsub = scope.onDetach(cb);
    unsub();
    cleanup.detach();
    expect(cb).toHaveBeenCalledTimes(0);
  });

  test("multiple onCleanup callbacks all called", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const cb3 = jest.fn();
    scope.onCleanup(cb1);
    scope.onCleanup(cb2);
    scope.onCleanup(cb3);
    cleanup();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb3).toHaveBeenCalledTimes(1);
  });

  test("multiple onDetach callbacks all called", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    scope.onDetach(cb1);
    scope.onDetach(cb2);
    cleanup.detach();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  test("double cleanup does not re-fire callbacks", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onCleanup(cb);
    cleanup();
    cleanup();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("double detach does not re-fire callbacks", () => {
    const [scope, cleanup] = Scope.createControlled();
    const cb = jest.fn();
    scope.onDetach(cb);
    cleanup.detach();
    cleanup.detach();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("cleanup then detach does not fire detach callbacks", () => {
    const [scope, cleanup] = Scope.createControlled();
    const detachCb = jest.fn();
    scope.onDetach(detachCb);
    cleanup();
    cleanup.detach();
    expect(detachCb).toHaveBeenCalledTimes(0);
  });

  test("onCleanup runs inside the scope being cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect.assertions(1);
    scope.onCleanup(() => {
      expect(Scope.currentScope).toBe(scope);
    });
    cleanup();
  });

  test("onDetach runs inside the scope being detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect.assertions(1);
    scope.onDetach(() => {
      expect(Scope.currentScope).toBe(scope);
    });
    cleanup.detach();
  });
});

describe("scope.signal", () => {
  test("signal is not aborted on alive scope", () => {
    const [scope, cleanup] = Scope.createControlled();
    expect(scope.signal.aborted).toBeFalse();
    cleanup();
  });

  test("signal is aborted after cleanup", () => {
    const [scope, cleanup] = Scope.createControlled();
    const signal = scope.signal;
    expect(signal.aborted).toBeFalse();
    cleanup();
    expect(signal.aborted).toBeTrue();
  });

  test("signal is not aborted after detach", () => {
    const [scope, cleanup] = Scope.createControlled();
    const signal = scope.signal;
    expect(signal.aborted).toBeFalse();
    cleanup.detach();
    expect(signal.aborted).toBeFalse();
  });

  test("signal accessed after cleanup is already aborted", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.signal.aborted).toBeTrue();
  });

  test("signal accessed after detach is not aborted", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.signal.aborted).toBeFalse();
  });

  test("same signal instance returned on multiple accesses", () => {
    const [scope, cleanup] = Scope.createControlled();
    const s1 = scope.signal;
    const s2 = scope.signal;
    expect(s1).toBe(s2);
    cleanup();
  });
});

describe("state transition edge cases", () => {
  test("cleanup is idempotent", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.state).toBe("cleaned");
    cleanup();
    expect(scope.state).toBe("cleaned");
  });

  test("detach is idempotent", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.state).toBe("detached");
    cleanup.detach();
    expect(scope.state).toBe("detached");
  });

  test("detach after cleanup stays cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup();
    expect(scope.state).toBe("cleaned");
    cleanup.detach();
    expect(scope.state).toBe("cleaned");
  });

  test("cleanup after detach stays detached", () => {
    const [scope, cleanup] = Scope.createControlled();
    cleanup.detach();
    expect(scope.state).toBe("detached");
    cleanup();
    expect(scope.state).toBe("detached");
  });
});

describe("context values", () => {
  test("setContext and getContext", () => {
    const scope = Scope.create();
    const id = createContextId<number>("test-ctx");
    scope.setContext(id, 42);
    expect(scope.getContext(id)).toBe(42);
  });

  test("hasContext returns false when not set", () => {
    const scope = Scope.create();
    const id = createContextId<string>("missing");
    expect(scope.hasContext(id)).toBeFalse();
  });

  test("hasContext returns true when set", () => {
    const scope = Scope.create();
    const id = createContextId<string>("present");
    scope.setContext(id, "hello");
    expect(scope.hasContext(id)).toBeTrue();
  });

  test("getContext throws when not found and no parent", () => {
    const scope = Scope.create();
    const id = createContextId<string>("missing");
    expect(() => scope.getContext(id)).toThrow("No context value found for id");
  });

  test("tryGetContext returns null when not found", () => {
    const scope = Scope.create();
    const id = createContextId<string>("missing");
    expect(scope.tryGetContext(id)).toBeNull();
  });

  test("getContext inherits from parent", () => {
    const parent = Scope.create();
    const child = Scope.create(parent);
    const id = createContextId<number>("inherited");
    parent.setContext(id, 99);
    expect(child.getContext(id)).toBe(99);
  });

  test("tryGetContext inherits from parent", () => {
    const parent = Scope.create();
    const child = Scope.create(parent);
    const id = createContextId<string>("inherited");
    parent.setContext(id, "from-parent");
    expect(child.tryGetContext(id)).toBe("from-parent");
  });

  test("child context shadows parent context", () => {
    const parent = Scope.create();
    const child = Scope.create(parent);
    const id = createContextId<number>("shadow");
    parent.setContext(id, 1);
    child.setContext(id, 2);
    expect(child.getContext(id)).toBe(2);
    expect(parent.getContext(id)).toBe(1);
  });

  test("hasContext does not check parent", () => {
    const parent = Scope.create();
    const child = Scope.create(parent);
    const id = createContextId<number>("parent-only");
    parent.setContext(id, 10);
    expect(child.hasContext(id)).toBeFalse();
    expect(parent.hasContext(id)).toBeTrue();
  });

  test("getContext traverses multiple ancestors", () => {
    const grandparent = Scope.create();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    const id = createContextId<string>("deep");
    grandparent.setContext(id, "from-grandparent");
    expect(child.getContext(id)).toBe("from-grandparent");
  });

  test("tryGetContext traverses multiple ancestors", () => {
    const grandparent = Scope.create();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    const id = createContextId<string>("deep");
    grandparent.setContext(id, "from-grandparent");
    expect(child.tryGetContext(id)).toBe("from-grandparent");
  });

  test("tryGetContext returns null through full chain with no match", () => {
    const grandparent = Scope.create();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    const id = createContextId<string>("nowhere");
    expect(child.tryGetContext(id)).toBeNull();
  });

  test("getContext throws through full chain with no match", () => {
    const grandparent = Scope.create();
    const parent = Scope.create(grandparent);
    const child = Scope.create(parent);
    const id = createContextId<string>("nowhere");
    expect(() => child.getContext(id)).toThrow("No context value found for id");
  });

  test("overwriting context value on same scope", () => {
    const scope = Scope.create();
    const id = createContextId<number>("overwrite");
    scope.setContext(id, 1);
    expect(scope.getContext(id)).toBe(1);
    scope.setContext(id, 2);
    expect(scope.getContext(id)).toBe(2);
  });

  test("different context ids are independent", () => {
    const scope = Scope.create();
    const id1 = createContextId<number>("a");
    const id2 = createContextId<string>("b");
    scope.setContext(id1, 42);
    scope.setContext(id2, "hello");
    expect(scope.getContext(id1)).toBe(42);
    expect(scope.getContext(id2)).toBe("hello");
  });

  test("createContextId with noSerialize uses symbol", () => {
    const id = createContextId<number>("no-ser", { noSerialize: true });
    expect(typeof id).toBe("symbol");
  });

  test("createContextId without noSerialize uses string", () => {
    const id = createContextId<number>("ser");
    expect(typeof id).toBe("string");
  });
});
