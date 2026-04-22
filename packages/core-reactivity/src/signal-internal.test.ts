import { describe, expect, test, jest } from "bun:test";
import { isInTrackingContext, listenForSignalReads, registerSignalCallback, triggerSignalCallbacks, triggerSignalRead, untrack, type SignalCallback, type SignalId } from "./signal-internal";
import { createUid } from "@lentjs/utils";

function createSignalId(): string {
  return createUid();
}

describe("register/trigger", () => {
  test("register new signal id", () => {
    const cb: SignalCallback = {
      onUpdate: () => {},
    };
    const signalId = createSignalId();
    expect(() => {
      registerSignalCallback(cb, signalId);
    }).pass();
  }, { repeats: 5 });

  test("register already canceled", () => {
    const cb: SignalCallback = {
      onUpdate: null,
    };
    const signalId = createSignalId();
    expect(() => {
      registerSignalCallback(cb, signalId);
    }).toThrow("Registering already canceled signal callback");
  }, { repeats: 5 });

  test("trigger new signal id", () => {
    const signalId = createSignalId();
    expect(() => {
      triggerSignalCallbacks(signalId);
    }).pass();
  }, { repeats: 5 });

  test("register than trigger", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb = { onUpdate };
    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBeNull();
  }, { repeats: 5 });

  test("trigger than register", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb = { onUpdate };

    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(cb.onUpdate).toBe(onUpdate);
  }, { repeats: 5 });

  test("trigger than register than trigger", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb = { onUpdate };

    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBeNull();
  }, { repeats: 5 });

  test("double trigger", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb = { onUpdate };

    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBeNull();
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBeNull();
  }, { repeats: 5 });

  test("setting back onUpdate to the callback", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb = { onUpdate };

    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBeNull();

    // Setting the onUpdate property again should not trigger another
    // update
    
    cb.onUpdate = onUpdate;
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(cb.onUpdate).toBe(onUpdate);
  }, { repeats: 5 });

  test("setting onUpdate null before triggering", () => {
    const onUpdate = jest.fn();
    const signalId = createSignalId();
    const cb: SignalCallback = { onUpdate };

    registerSignalCallback(cb, signalId)
    expect(onUpdate).toHaveBeenCalledTimes(0);
    
    cb.onUpdate = null;
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(cb.onUpdate).toBeNull();

    cb.onUpdate = onUpdate;
    triggerSignalCallbacks(signalId);
    expect(onUpdate).toHaveBeenCalledTimes(0);
    expect(cb.onUpdate).toBe(onUpdate);
  }, { repeats: 5 });
});

describe("listen/untrack etc...", () => {
  test("listenForSignalReads calls the fn immediately and only once", () => {
    const fn = jest.fn(() => "my_value");
    const result = listenForSignalReads(fn, []);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe("my_value");
  });

  test("empty callbacks yields no signal reads", () => {
    const reads: SignalId[] = [];
    listenForSignalReads(() => {}, reads);
    expect(reads).toBeEmpty();
  });

  test("trigger a signal id read", () => {
    const reads: SignalId[] = [];
    const signalId = createSignalId();

    listenForSignalReads(() => {
      triggerSignalRead(signalId);
    }, reads);
    expect(reads).toBeArrayOfSize(1);
    expect(reads[0]).toBe(signalId);
  });

  test("trigger multiple time the same signal id", () => {
    const reads: SignalId[] = [];
    const signalId = createSignalId();

    listenForSignalReads(() => {
      triggerSignalRead(signalId);
      triggerSignalRead(signalId);
    }, reads);
    expect(reads).toBeArrayOfSize(2);
    expect(reads[0]).toBe(signalId);
    expect(reads[1]).toBe(signalId);
  });

  test("trigger multiple signal ids", () => {
    const reads: SignalId[] = [];
    const signalId1 = createSignalId();
    const signalId2 = createSignalId();

    listenForSignalReads(() => {
      triggerSignalRead(signalId1);
      triggerSignalRead(signalId2);
    }, reads);
    expect(reads).toBeArrayOfSize(2);
    expect(reads[0]).toBe(signalId1);
    expect(reads[1]).toBe(signalId2);
  });

  test("untrack calls its callback once and returns its value", () => {
    const cb = jest.fn(() => "my_test");
    const result = untrack(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(result).toBe("my_test");
  });

  test("listenForSignalReads with untrack inside", () => {
    const signalId1 = createSignalId();
    const signalId2 = createSignalId();
    const signalId3 = createSignalId();

    const untrack_cb = jest.fn(() => {
      triggerSignalRead(signalId2);
    });
    const listen_cb = jest.fn(() => {
      triggerSignalRead(signalId1);
      untrack(untrack_cb);
      triggerSignalRead(signalId3);
    });
    const signalReads: SignalId[] = [];
    listenForSignalReads(listen_cb, signalReads);
    expect(listen_cb).toHaveBeenCalledTimes(1);
    expect(untrack_cb).toHaveBeenCalledTimes(1);
    expect(signalReads).toBeArrayOfSize(2);
    expect(signalReads[0]).toBe(signalId1);
    expect(signalReads[1]).toBe(signalId3);
  });

  test("isInTrackingContext alone returns false", () => {
    expect(isInTrackingContext()).toBeFalse();
  });

  test("isInTrackingContext in listenForSignalReads returns true", () => {
    expect.assertions(1);
    listenForSignalReads(() => {
      expect(isInTrackingContext()).toBeTrue();
    }, []);
  });

  test("isInTrackingContext in untrack returns false", () => {
    expect.assertions(1);
    untrack(() => {
      expect(isInTrackingContext()).toBeFalse();
    });
  });

  test("isInTrackingContext in listenForSignalReads in untrack returns false", () => {
    expect.assertions(3);
    listenForSignalReads(() => {
      expect(isInTrackingContext()).toBeTrue();
      untrack(() => {
        expect(isInTrackingContext()).toBeFalse();
      });
      expect(isInTrackingContext()).toBeTrue();
    }, []);
  });
});
