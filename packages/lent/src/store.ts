function filterInPlace<T>(arr: T[], pred: (v: T) => boolean) {
  arr.splice(0, Infinity, ...arr.filter(pred));
  // let j = 0;
  // for (let i = 0; i < arr.length; i++) {
  //   const val = arr[i]!;
  //   if (pred(val))
  //     arr[j++] = val;
  // }
  // arr.length = j;
}

function newId(): string {
  return crypto.randomUUID().split("-",1)[0]!;
}

const isStoreSymbol = Symbol("is_store");
export const storeIdSymbol = Symbol("store_id");

export type StoreRead = { kind: "store", id: string, property: string | symbol } | { kind: "signal", id: string };
export type Store<S> = S & { [isStoreSymbol]: true, [storeIdSymbol]: string };
export type StoreReadCallback = {
  is_stopped?: boolean,
  once?: boolean,
  onUpdate?: () => void,
};
export type StoreReadListener = {
  found_reads: StoreRead[],
};

let current_store_read_listener: StoreReadListener | null = null;
type StoreState = {
  props_callbacks: Map<string | symbol, StoreReadCallback[]>,
  obj: any,
  store: Store<any>,
};
export let stores = new Map<string, StoreState>;

export function resumeStore<S extends object>(store_id: string, obj: S): Store<S> {
  let props_callbacks = new Map<string | symbol, StoreReadCallback[]>;

  const store = new Proxy<any>(obj, {
    has: (obj, prop) => {
      return prop === isStoreSymbol ||
        prop === storeIdSymbol ||
        prop in obj;
    },
    set: (obj, prop, value) => {
      if (prop === isStoreSymbol && prop === storeIdSymbol) { return false; }

      const changed = obj[prop] !== value;
      // @ts-ignore
      obj[prop] = value;
      if (changed) {
        const arr = props_callbacks.get(prop);
        if (arr) {
          for (const cb of arr) {
            if (!cb.is_stopped)
              cb.onUpdate?.();
            if (cb.once)
              cb.is_stopped = true;
          }
          filterInPlace(arr, cb => cb.is_stopped !== true);
        }
      }
      return true;
    },
    get(obj, prop) {
      if (prop === isStoreSymbol) { return true; }
      if (prop === storeIdSymbol) { return store_id; }

      if (current_store_read_listener !== null) {
        if (!current_store_read_listener.found_reads.some(e => e.kind === "store" && e.id === store_id && e.property === prop))
          current_store_read_listener.found_reads.push({ kind: "store", id: store_id, property: prop });
      }

      return obj[prop];
    },
  });

  stores.set(store_id, {
    obj,
    props_callbacks,
    store,
  });

  return store;
}

export function createStore<S extends object>(obj: S): Store<S> {
  return resumeStore(newId(), obj);
}

export function isStore<S>(s: S): s is Store<S> {
  return typeof s === "object" && s !== null && isStoreSymbol in s && s[isStoreSymbol] === true;
}

export function getStoreId(store: Store<unknown>): string {
  return store[storeIdSymbol];
}

export function storeFromId(id: string): Store<unknown> | null {
  return stores.get(id)?.store;
}

type SignalState = {
  currentValue: unknown;
  callbacks: StoreReadCallback[];
};
export let signals: Map<string, SignalState> = new Map;

const signalAccessorSymbol = Symbol("signal-accessor");
const signalSetterSymbol = Symbol("signal-setter");
export type SignalData = { signalId: string };
export type SignalAccessor<V> = (() => V) & { [signalAccessorSymbol]: true } & SignalData;
export type SignalSetter<V> = ((new_val: V) => void) & { [signalSetterSymbol]: true } & SignalData;

export function createSignal<V>(initialValue: V): [SignalAccessor<V>, SignalSetter<V>] {
  const id = newId();
  signals.set(id, {
    callbacks: [],
    currentValue: initialValue,
  });

  // @ts-ignore
  return [signalAccessorFromId(id), signalSetterFromId(id)];
}

export function signalAccessorFromId(signal_id: string): SignalAccessor<unknown> {
  const accessor: SignalAccessor<unknown> = () => {
    const state = signals.get(signal_id);
    if (!state) throw new Error(`No signal found with id ${signal_id}`);

    if (current_store_read_listener !== null) {
      if (!current_store_read_listener.found_reads.some(e => e.kind === "store" && e.id === signal_id))
        current_store_read_listener.found_reads.push({ kind: "signal", id: signal_id });
    }

    return state.currentValue;
  };
  accessor[signalAccessorSymbol] = true;
  accessor.signalId = signal_id;
  return accessor;
}

export function signalSetterFromId(id: string): SignalSetter<unknown> {
  const setter: SignalSetter<unknown> = (new_value: unknown) => {
    const state = signals.get(id);
    if (!state) throw new Error(`No signal found with id ${id}`);

    const changed = new_value !== state.currentValue;
    state.currentValue = new_value;

    if (changed) {
      for (const cb of state.callbacks) {
        if (!cb.is_stopped)
          cb.onUpdate?.();
        if (cb.once)
          cb.is_stopped = true;
      }
      filterInPlace(state.callbacks, cb => cb.is_stopped !== true);
    }
  };
  setter[signalSetterSymbol] = true;
  setter.signalId = id;
  return setter;
}

export function isSignalAccessor(val: unknown): val is SignalAccessor<unknown> {
  return typeof val === "function" && val !== null && signalAccessorSymbol in val && val[signalAccessorSymbol] === true;
}

export function isSignalSetter(val: unknown): val is SignalSetter<never> {
  return typeof val === "function" && val !== null && signalSetterSymbol in val && val[signalSetterSymbol] === true;
}

export type Unsubscribe = () => void;
export function subscribeToStoreReads(cb: () => void, reads: StoreRead[], options?: { once?: boolean }): Unsubscribe {
  const callback: StoreReadCallback = {
    onUpdate: cb,
    once: options?.once ?? false,
  };

  for (const read of reads) {
    if (read.kind === "store") {
      const store = stores.get(read.id);
      if (!store) throw new Error(`No such store with id ${read.id}`);
      let arr = store.props_callbacks.get(read.property);
      if (!arr) store.props_callbacks.set(read.property, arr = []);
      arr.push(callback);
    }
    else if (read.kind === "signal") {
      const signal = signals.get(read.id);
      if (!signal) throw new Error(`No such signal with id ${read.id}`);
      signal.callbacks.push(callback);
    }
    else {
      read satisfies never;
    }
  }

  return () => {
    callback.is_stopped = true;
  };
}

export function listenForStoreReads<T>(cb: () => T): [T, StoreRead[]] {
  const found_reads: StoreRead[] = [];
  const previousListener = current_store_read_listener;
  current_store_read_listener = { found_reads };
  try {
    const val = cb();
    return [val, found_reads];
  }
  catch(e) {
    throw e;
  }
  finally {
    current_store_read_listener = previousListener;
  }
}

export function untrack<T>(cb: () => T): T {
  const old_read_callback = current_store_read_listener;
  current_store_read_listener = null;

  try {
    return cb();
  }
  catch(e) {
    throw e;
  }
  finally {
    current_store_read_listener = old_read_callback;
  }
}
