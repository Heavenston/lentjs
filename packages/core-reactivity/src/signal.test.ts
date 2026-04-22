import { describe, expect, test, jest } from "bun:test";
import { createSignal, isSignalAccessor, isSignalSetter } from "./signal";
import { listenForSignalReads, registerSignalCallback, untrack, type SignalId } from "./signal-internal";
import { serialize, deserialize } from "@lentjs/core-serialize";

describe("createSignal", () => {
  test("returns a tuple of [accessor, setter]", () => {
    const result = createSignal(0);
    expect(result).toBeArrayOfSize(2);
    expect(typeof result[0]).toBe("function");
    expect(typeof result[1]).toBe("function");
  });

  test("accessor returns initial value", () => {
    const [accessor] = createSignal(42);
    expect(accessor()).toBe(42);
  });

  test("setter updates value, accessor reflects it", () => {
    const [accessor, setter] = createSignal(0);
    setter(10);
    expect(accessor()).toBe(10);
  });

  test("accessor and setter share the same signalId", () => {
    const [accessor, setter] = createSignal(0);
    expect(accessor.signalId).toBe(setter.signalId);
  });

  test("signalId is a string", () => {
    const [accessor] = createSignal(0);
    expect(typeof accessor.signalId).toBe("string");
  });
});

describe("signal accessor", () => {
  test("triggers signal read when called", () => {
    const [accessor] = createSignal(0);
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      accessor();
    }, reads);
    expect(reads).toBeArrayOfSize(1);
    expect(reads[0]).toBe(accessor.signalId);
  });

  test("does not trigger signal read inside untrack", () => {
    const [accessor] = createSignal(0);
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      untrack(() => {
        accessor();
      });
    }, reads);
    expect(reads).toBeEmpty();
  });

  test("multiple calls return current value each time", () => {
    const [accessor, setter] = createSignal(0);
    expect(accessor()).toBe(0);
    setter(1);
    expect(accessor()).toBe(1);
    setter(2);
    expect(accessor()).toBe(2);
  });
});

describe("signal setter", () => {
  test("triggers callbacks when value changes", () => {
    const [accessor, setter] = createSignal(0);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("does not trigger callbacks when setting same value", () => {
    const [accessor, setter] = createSignal(5);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter(5);
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("setting same primitive does not trigger", () => {
    const [accessor, setter] = createSignal("hello");
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter("hello");
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("setting NaN when already NaN always triggers", () => {
    const [accessor, setter] = createSignal(NaN);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter(NaN);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("setting same object reference does not trigger", () => {
    const obj = { a: 1 };
    const [accessor, setter] = createSignal(obj);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter(obj);
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("setting different object with same shape triggers", () => {
    const [accessor, setter] = createSignal({ a: 1 });
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter({ a: 1 });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("updates value even when not changed", () => {
    const [accessor, setter] = createSignal(5);
    setter(5);
    expect(accessor()).toBe(5);
  });
});

describe("setter.update", () => {
  test("applies functional update", () => {
    const [accessor, setter] = createSignal(10);
    setter.update(v => v + 5);
    expect(accessor()).toBe(15);
  });

  test("receives current value as argument", () => {
    const [_accessor, setter] = createSignal(42);
    const updater = jest.fn((v: number) => v);
    setter.update(updater);
    expect(updater).toHaveBeenCalledWith(42);
  });

  test("does not trigger when updater returns same value", () => {
    const [accessor, setter] = createSignal(5);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter.update(v => v);
    expect(onUpdate).toHaveBeenCalledTimes(0);
  });

  test("triggers when updater returns new value", () => {
    const [accessor, setter] = createSignal(5);
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, accessor.signalId);
    setter.update(v => v + 1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("isSignalAccessor", () => {
  test("true for a real accessor", () => {
    const [accessor] = createSignal(0);
    expect(isSignalAccessor(accessor)).toBeTrue();
  });

  test("false for a real setter", () => {
    const [, setter] = createSignal(0);
    expect(isSignalAccessor(setter)).toBeFalse();
  });

  test("false for a regular function", () => {
    expect(isSignalAccessor(() => {})).toBeFalse();
  });

  test("false for null", () => {
    expect(isSignalAccessor(null)).toBeFalse();
  });

  test("false for undefined", () => {
    expect(isSignalAccessor(undefined)).toBeFalse();
  });

  test("false for a plain object", () => {
    expect(isSignalAccessor({ signalId: "test" })).toBeFalse();
  });

  test("false for a number", () => {
    expect(isSignalAccessor(42)).toBeFalse();
  });

  test("false for a string", () => {
    expect(isSignalAccessor("hello")).toBeFalse();
  });
});

describe("isSignalSetter", () => {
  test("true for a real setter", () => {
    const [, setter] = createSignal(0);
    expect(isSignalSetter(setter)).toBeTrue();
  });

  test("false for a real accessor", () => {
    const [accessor] = createSignal(0);
    expect(isSignalSetter(accessor)).toBeFalse();
  });

  test("false for a regular function", () => {
    expect(isSignalSetter(() => {})).toBeFalse();
  });

  test("false for null", () => {
    expect(isSignalSetter(null)).toBeFalse();
  });

  test("false for undefined", () => {
    expect(isSignalSetter(undefined)).toBeFalse();
  });

  test("false for a plain object", () => {
    expect(isSignalSetter({ signalId: "test" })).toBeFalse();
  });

  test("false for a number", () => {
    expect(isSignalSetter(42)).toBeFalse();
  });

  test("false for a string", () => {
    expect(isSignalSetter("hello")).toBeFalse();
  });
});

describe("signal serialization", () => {
  test("accessor serialized and deserialized returns same value", () => {
    const [accessor] = createSignal(42);
    const text = serialize(accessor);
    const restored = deserialize(text) as typeof accessor;
    expect(restored()).toBe(42);
  });

  test("setter serialized and deserialized can update the value", () => {
    const [, setter] = createSignal(0);
    const text = serialize(setter);
    const restoredSetter = deserialize(text) as typeof setter;
    // Restored setter operates on a restored state from serialization
    expect(() => restoredSetter(99)).not.toThrow();
  });

  test("accessor and setter from same createSignal share state after deserialization", () => {
    const [accessor, setter] = createSignal(0);
    const text = serialize([accessor, setter]);
    const [restoredAccessor, restoredSetter] = deserialize(text) as [typeof accessor, typeof setter];
    expect(restoredAccessor()).toBe(0);
    restoredSetter(77);
    expect(restoredAccessor()).toBe(77);
  });

  test("deserialized accessor triggers signal reads", () => {
    const [accessor] = createSignal(10);
    const text = serialize(accessor);
    const restored = deserialize(text) as typeof accessor;
    const reads: SignalId[] = [];
    listenForSignalReads(() => {
      restored();
    }, reads);
    expect(reads).toBeArrayOfSize(1);
  });

  test("deserialized setter triggers signal callbacks on change", () => {
    const [accessor, setter] = createSignal(0);
    const text = serialize([accessor, setter]);
    const [restoredAccessor, restoredSetter] = deserialize(text) as [typeof accessor, typeof setter];
    const onUpdate = jest.fn();
    registerSignalCallback({ onUpdate }, restoredAccessor.signalId);
    restoredSetter(5);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("deserialized accessor is recognized by isSignalAccessor", () => {
    const [accessor] = createSignal(0);
    const text = serialize(accessor);
    const restored = deserialize(text);
    expect(isSignalAccessor(restored)).toBeTrue();
  });

  test("deserialized setter is recognized by isSignalSetter", () => {
    const [, setter] = createSignal(0);
    const text = serialize(setter);
    const restored = deserialize(text);
    expect(isSignalSetter(restored)).toBeTrue();
  });
});
