import { assert } from "@lentjs/utils";

export type SignalId = string;

export type SignalCallback = {
  /**
   * onUpdate is set to null once been called
   * Ensuring it's only called once
   */
  onUpdate: (() => void) | null,
};
export type SignalCleanup = (() => void);
const signalCallbacks = new Map<SignalId, SignalCallback[]>;

export type SignalReadListener = {
  signalReads: SignalId[],
};
let currentSignalListener: SignalReadListener | null = null;

// export function registerSignalId(id: SignalId) {
//   signalCallbacks.set(id, []);
// }

// export function unregisterSignalId(id: SignalId) {
//   signalCallbacks.delete(id);
// }

export function registerSignalCallback(callback: SignalCallback, id: SignalId) {
  assert(callback.onUpdate !== null, "Registering already canceled signal callback");
  let callbacks = signalCallbacks.get(id);
  if (!callbacks)
    signalCallbacks.set(id, callbacks = []);
  callbacks.push(callback);
}

export function triggerSignalCallbacks(id: SignalId) {
  const callbacks = signalCallbacks.get(id);
  if (!callbacks) return;
  signalCallbacks.set(id, []);
  callbacks.forEach(cb => {
    const fn = cb.onUpdate;
    cb.onUpdate = null;
    fn?.();
  });
}

export function triggerSignalRead(id: SignalId) {
  currentSignalListener?.signalReads.push(id);
}

export function listenForSignalReads<T>(cb: () => T, signalReads: SignalId[]): T {
  const previousListener = currentSignalListener;
  currentSignalListener = { signalReads };
  try {
    return cb();
  }
  catch(e) {
    throw e;
  }
  finally {
    currentSignalListener = previousListener;
  }
}

export function untrack<T>(cb: () => T): T {
  const old_read_callback = currentSignalListener;
  currentSignalListener = null;

  try {
    return cb();
  }
  catch(e) {
    throw e;
  }
  finally {
    currentSignalListener = old_read_callback;
  }
}
