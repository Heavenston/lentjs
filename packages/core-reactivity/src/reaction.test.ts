import { describe, expect, test, jest } from "bun:test";
import { combineReactivityData, createReaction, EMPTY_REACTIVITY_DATA, resumeReaction, startReaction } from "./reaction";
import { createSignal } from "./signal";

describe("EMPTY_REACTIVITY_DATA", () => {
  test("is frozen", () => {
    expect(Object.isFrozen(EMPTY_REACTIVITY_DATA)).toBeTrue();
  });

  test("has length 0", () => {
    expect(EMPTY_REACTIVITY_DATA.length).toBe(0);
  });
});

describe("combineReactivityData", () => {
  test("combining two empty yields frozen empty", () => {
    const result = combineReactivityData(EMPTY_REACTIVITY_DATA, EMPTY_REACTIVITY_DATA);
    expect(result.length).toBe(0);
    expect(Object.isFrozen(result)).toBeTrue();
  });

  test("combining non-empty with empty preserves entries", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const result = combineReactivityData(data, EMPTY_REACTIVITY_DATA);
    expect(result.length).toBe(data.length);
  });

  test("combining empty with non-empty preserves entries", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const result = combineReactivityData(EMPTY_REACTIVITY_DATA, data);
    expect(result.length).toBe(data.length);
  });

  test("combining two non-empty concatenates", () => {
    const [accessor1] = createSignal(0);
    const [accessor2] = createSignal(0);
    const [, data1] = startReaction(() => accessor1());
    const [, data2] = startReaction(() => accessor2());
    const result = combineReactivityData(data1, data2);
    expect(result.length).toBe(data1.length + data2.length);
  });

  test("result is frozen", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const result = combineReactivityData(data, EMPTY_REACTIVITY_DATA);
    expect(Object.isFrozen(result)).toBeTrue();
  });
});

describe("startReaction", () => {
  test("returns the callback's return value", () => {
    const [val] = startReaction(() => 42);
    expect(val).toBe(42);
  });

  test("captures signal reads from accessor calls", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    expect(data.length).toBe(1);
  });

  test("returns empty reactivity data when no signals read", () => {
    const [, data] = startReaction(() => {});
    expect(data.length).toBe(0);
  });

  test("captures multiple reads of same signal", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => {
      accessor();
      accessor();
    });
    expect(data.length).toBe(2);
  });

  test("captures reads from multiple signals", () => {
    const [accessor1] = createSignal(0);
    const [accessor2] = createSignal(0);
    const [, data] = startReaction(() => {
      accessor1();
      accessor2();
    });
    expect(data.length).toBe(2);
  });

  test("result reactivity data is frozen", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    expect(Object.isFrozen(data)).toBeTrue();
  });
});

describe("createReaction", () => {
  test("calls the reaction immediately", () => {
    const reaction = jest.fn();
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });

  test("re-runs reaction when a read signal changes", () => {
    const [accessor, setter] = createSignal(0);
    const reaction = jest.fn(() => { accessor(); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(2);
    unsub();
  });

  test("does not re-run when signal set to same value", () => {
    const [accessor, setter] = createSignal(5);
    const reaction = jest.fn(() => { accessor(); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    setter(5);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });

  test("does not re-run when unrelated signal changes", () => {
    const [accessor] = createSignal(0);
    const [, unrelatedSetter] = createSignal(0);
    const reaction = jest.fn(() => { accessor(); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    unrelatedSetter(99);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });

  test("re-runs only once per trigger even if multiple signals read", () => {
    const [accessor1, setter1] = createSignal(0);
    const [accessor2] = createSignal(0);
    const reaction = jest.fn(() => {
      accessor1();
      accessor2();
    });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    setter1(1);
    expect(reaction).toHaveBeenCalledTimes(2);
    unsub();
  });

  test("tracks new signals on re-run (dynamic dependencies)", () => {
    const [toggle, setToggle] = createSignal(false);
    const [accessor, setter] = createSignal(0);
    const reaction = jest.fn(() => {
      if (toggle()) accessor();
    });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);

    // accessor not read yet, changing it should not trigger
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(1);

    // toggle on — reaction re-runs and now reads accessor
    setToggle(true);
    expect(reaction).toHaveBeenCalledTimes(2);

    // now accessor is tracked, changing it should trigger
    setter(2);
    expect(reaction).toHaveBeenCalledTimes(3);
    unsub();
  });

  test("drops old signal dependencies on re-run", () => {
    const [toggle, setToggle] = createSignal(true);
    const [accessor, setter] = createSignal(0);
    const reaction = jest.fn(() => {
      if (toggle()) accessor();
    });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);

    // accessor is tracked, changing triggers
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(2);

    // toggle off — reaction re-runs but no longer reads accessor
    setToggle(false);
    expect(reaction).toHaveBeenCalledTimes(3);

    // accessor no longer tracked
    setter(2);
    expect(reaction).toHaveBeenCalledTimes(3);
    unsub();
  });

  test("multiple reactions on same signal all fire", () => {
    const [accessor, setter] = createSignal(0);
    const reaction1 = jest.fn(() => { accessor(); });
    const reaction2 = jest.fn(() => { accessor(); });
    const unsub1 = createReaction(reaction1);
    const unsub2 = createReaction(reaction2);
    expect(reaction1).toHaveBeenCalledTimes(1);
    expect(reaction2).toHaveBeenCalledTimes(1);
    setter(1);
    expect(reaction1).toHaveBeenCalledTimes(2);
    expect(reaction2).toHaveBeenCalledTimes(2);
    unsub1();
    unsub2();
  });

  test("unsub stops future re-runs", () => {
    const [accessor, setter] = createSignal(0);
    const reaction = jest.fn(() => { accessor(); });
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(1);
  });

  test("unsub returns CapturedReactivityData", () => {
    const [accessor] = createSignal(0);
    const unsub = createReaction(() => { accessor(); });
    const data = unsub();
    expect(data.length).toBe(1);
  });

  test("unsub called multiple times is safe", () => {
    const [accessor] = createSignal(0);
    const unsub = createReaction(() => { accessor(); });
    unsub();
    expect(() => unsub()).not.toThrow();
  });

  test("reaction that reads no signals is never re-triggered", () => {
    const [, setter] = createSignal(0);
    const reaction = jest.fn();
    const unsub = createReaction(reaction);
    expect(reaction).toHaveBeenCalledTimes(1);
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });
});

describe("resumeReaction", () => {
  test("does not call the reaction immediately", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const reaction = jest.fn(() => { accessor(); });
    const unsub = resumeReaction(reaction, data);
    expect(reaction).toHaveBeenCalledTimes(0);
    unsub();
  });

  test("calls the reaction when a resumed signal triggers", () => {
    const [accessor, setter] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const reaction = jest.fn(() => { accessor(); });
    const unsub = resumeReaction(reaction, data);
    expect(reaction).toHaveBeenCalledTimes(0);
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(1);
    unsub();
  });

  test("after first trigger, re-tracks signals from the reaction run", () => {
    const [accessor1, setter1] = createSignal(0);
    const [accessor2, setter2] = createSignal(0);
    // Resume with only accessor1 tracked
    const [, data] = startReaction(() => accessor1());
    // But the reaction reads accessor2
    const reaction = jest.fn(() => { accessor2(); });
    const unsub = resumeReaction(reaction, data);

    // Trigger via accessor1 (the resumed signal)
    setter1(1);
    expect(reaction).toHaveBeenCalledTimes(1);

    // Now accessor2 should be tracked from the run, not accessor1
    setter2(1);
    expect(reaction).toHaveBeenCalledTimes(2);

    // accessor1 no longer tracked
    setter1(2);
    expect(reaction).toHaveBeenCalledTimes(2);
    unsub();
  });

  test("unsub stops future re-runs", () => {
    const [accessor, setter] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const reaction = jest.fn(() => { accessor(); });
    const unsub = resumeReaction(reaction, data);
    unsub();
    setter(1);
    expect(reaction).toHaveBeenCalledTimes(0);
  });

  test("unsub before any trigger returns the provided reactivity data", () => {
    const [accessor] = createSignal(0);
    const [, data] = startReaction(() => accessor());
    const unsub = resumeReaction(() => { accessor(); }, data);
    const returned = unsub();
    expect(returned).toBe(data);
  });
});
