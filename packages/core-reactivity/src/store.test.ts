import { describe, expect, test, jest } from "bun:test";
import { createStore, getStoreId, isStore } from "./store";
import { listenForSignalReads, registerSignalCallback, type SignalId } from "./signal-internal";
import { createReaction } from "./reaction";
import { serialize, deserialize } from "@lentjs/core-serialize";
import { blackbox } from "@lentjs/utils";

describe("createStore", () => {
  test("get returns property value", () => {
    const store = createStore({ a: 1, b: "hello" });
    expect(store.a).toBe(1);
    expect(store.b).toBe("hello");
  });

  test("set updates property value", () => {
    const store = createStore({ a: 1 });
    store.a = 2;
    expect(store.a).toBe(2);
  });

  test("get undefined property returns undefined", () => {
    const store = createStore({} as { x?: number });
    expect(store.x).toBeUndefined();
  });

  test("multiple properties work independently", () => {
    const store = createStore({ a: 1, b: 2 });
    store.a = 10;
    expect(store.a).toBe(10);
    expect(store.b).toBe(2);
  });
});

describe("store get trap", () => {
  test("triggers signal read on property access", () => {
    const store = createStore({ a: 1 });
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      blackbox(store.a);
    }, reads);
    expect(reads).toBeArrayOfSize(1);
  });

  test("different properties trigger different signal reads", () => {
    const store = createStore({ a: 1, b: 2 });
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      blackbox(store.a);
      blackbox(store.b);
    }, reads);
    expect(reads).toBeArrayOfSize(2);
    expect(reads[0]).not.toBe(reads[1]);
  });

  test("get with symbol key throws", () => {
    const store = createStore({ a: 1 });
    const sym = Symbol("test");
    expect(() => {
      blackbox((store as any)[sym]);
    }).toThrow("Symbol keys inside store are not supported");
  });
});

describe("store set trap", () => {
  test("triggers signal callbacks when value changes", () => {
    const store = createStore({ a: 1 });
    const storeId = getStoreId(store);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, `${storeId}_a`);
    store.a = 2;
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("does not trigger when same value assigned", () => {
    const store = createStore({ a: 1 });
    const storeId = getStoreId(store);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, `${storeId}_a`);
    store.a = 1;
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("set with symbol key throws", () => {
    const store = createStore({ a: 1 });
    const sym = Symbol("test");
    expect(() => {
      (store as any)[sym] = "value";
    }).toThrow("Symbol keys inside store are not supported");
  });

  test("adding a new property works and triggers", () => {
    const store = createStore({} as { x?: number });
    const storeId = getStoreId(store);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, `${storeId}_x`);
    store.x = 42;
    expect(store.x).toBe(42);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("store has trap", () => {
  test("returns true for own properties", () => {
    const store = createStore({ a: 1 });
    expect("a" in store).toBeTrue();
  });

  test("returns false for missing properties", () => {
    const store = createStore({ a: 1 });
    expect("b" in store).toBeFalse();
  });
});

describe("isStore", () => {
  test("true for a store", () => {
    const store = createStore({ a: 1 });
    expect(isStore(store)).toBeTrue();
  });

  test("false for a plain object", () => {
    expect(isStore({ a: 1 })).toBeFalse();
  });

  test("false for null", () => {
    expect(isStore(null)).toBeFalse();
  });

  test("false for undefined", () => {
    expect(isStore(undefined)).toBeFalse();
  });

  test("false for a number", () => {
    expect(isStore(42)).toBeFalse();
  });

  test("false for a string", () => {
    expect(isStore("hello")).toBeFalse();
  });

  test("false for a function", () => {
    expect(isStore(() => {})).toBeFalse();
  });
});

describe("getStoreId", () => {
  test("returns a string", () => {
    const store = createStore({ a: 1 });
    expect(typeof getStoreId(store)).toBe("string");
  });

  test("different stores have different ids", () => {
    const store1 = createStore({ a: 1 });
    const store2 = createStore({ a: 1 });
    expect(getStoreId(store1)).not.toBe(getStoreId(store2));
  });
});

describe("store reactivity integration", () => {
  test("createReaction re-runs when store property changes", () => {
    const store = createStore({ count: 0 });
    const reaction = jest.fn(() => { blackbox(store.count); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    store.count = 1;
    expect(reaction).toHaveBeenCalledTimes(2);
    unsub();
  });

  test("createReaction does not re-run for unread property changes", () => {
    const store = createStore({ a: 0, b: 0 });
    const reaction = jest.fn(() => { blackbox(store.a); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    store.b = 99;
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });

  test("createReaction re-runs when a newly added property changes", () => {
    const store = createStore({} as { x?: number });
    const reaction = jest.fn(() => { blackbox(store.x); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    store.x = 42;
    expect(reaction).toHaveBeenCalledTimes(2);
    unsub();
  });
});

describe("store serialization", () => {
  test("serialized and deserialized store has same property values", () => {
    const store = createStore({ a: 1, b: "hello" });
    const text = serialize(store);
    const restored = deserialize(text) as typeof store;
    expect(restored.a).toBe(1);
    expect(restored.b).toBe("hello");
  });

  test("deserialized store get triggers signal reads", () => {
    const store = createStore({ a: 1 });
    const text = serialize(store);
    const restored = deserialize(text) as typeof store;
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      blackbox(restored.a);
    }, reads);
    expect(reads).toBeArrayOfSize(1);
  });

  test("deserialized store set triggers callbacks on change", () => {
    const store = createStore({ a: 1 });
    const text = serialize(store);
    const restored = deserialize(text) as typeof store;
    const storeId = getStoreId(restored);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, `${storeId}_a`);
    restored.a = 2;
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("deserialized store is recognized by isStore", () => {
    const store = createStore({ a: 1 });
    const text = serialize(store);
    const restored = deserialize(text);
    expect(isStore(restored)).toBeTrue();
  });

  test("getStoreId on deserialized store returns same id as original", () => {
    const store = createStore({ a: 1 });
    const originalId = getStoreId(store);
    const text = serialize(store);
    const restored = deserialize(text) as typeof store;
    expect(getStoreId(restored)).toBe(originalId);
  });
});
