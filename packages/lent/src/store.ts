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

const isStoreSymbol = Symbol("is_store");
export const storeIdSymbol = Symbol("store_id");

export type StoreRead = { kind: "store", id: string, property: string | symbol } | { kind: "signal", id: string };
export type Store<S> = S & { [isStoreSymbol]: true, [storeIdSymbol]: string };
export type StoreReadCallback = {
  is_stopped?: boolean,
  once?: boolean,
  onUpdate?: () => void,
  found_reads?: StoreRead[],
};

let current_store_read_callback: StoreReadCallback | null = null;
export function createStore<S extends object>(initialValue: S): Store<S> {
  let prop_callbacks = new Map<string | symbol, StoreReadCallback[]>;
  const store_id = crypto.randomUUID();

  return new Proxy<any>(initialValue, {
    set: (obj, prop, value) => {
      if (prop === isStoreSymbol && prop === storeIdSymbol) { return false; }

      const changed = obj[prop] !== value;
      // @ts-ignore
      obj[prop] = value;
      if (changed) {
        const arr = prop_callbacks.get(prop);
        if (arr) {
          filterInPlace(arr, cb => cb.is_stopped !== true);
          for (const cb of arr)
            cb.onUpdate?.();
          filterInPlace(arr, cb => cb.once !== true);
        }
      }
      return true;
    },
    get(obj, prop) {
      if (prop === isStoreSymbol) { return true; }
      if (prop === storeIdSymbol) { return store_id; }

      if (current_store_read_callback !== null) {
        const prop_array = prop_callbacks.get(prop) ?? prop_callbacks.set(prop, []).get(prop)!;
        if (!prop_array.includes(current_store_read_callback)) {
          prop_array.push(current_store_read_callback);
          current_store_read_callback.found_reads?.push({ kind: "store", id: store_id, property: prop })
        }
      }

      return obj[prop];
    },
  });
}

export function getStoreId(store: Store<unknown>): string {
  return store[storeIdSymbol];
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
  const id = crypto.randomUUID();
  signals.set(id, {
    callbacks: [],
    currentValue: initialValue,
  });

  // @ts-ignore
  return [signalAccessorFromId(id), signalSetterFromId(id)];
}

export function signalAccessorFromId(id: string): SignalAccessor<unknown> {
  const accessor: SignalAccessor<unknown> = () => {
    const state = signals.get(id);
    if (!state) throw new Error(`No signal found with id ${id}`);

    if (current_store_read_callback !== null) {
      if (!state.callbacks.includes(current_store_read_callback)) {
        state.callbacks.push(current_store_read_callback);
        current_store_read_callback.found_reads?.push({ kind: "signal", id });
      }
    }
    return state.currentValue;
  };
  accessor[signalAccessorSymbol] = true;
  accessor.signalId = id;
  return accessor;
}

export function signalSetterFromId(id: string): SignalSetter<unknown> {
  const setter: SignalSetter<unknown> = (new_value: unknown) => {
    const state = signals.get(id);
    if (!state) throw new Error(`No signal found with id ${id}`);

    const changed = new_value !== state.currentValue;
    state.currentValue = new_value;

    if (changed) {
      filterInPlace(state.callbacks, cb => cb.is_stopped !== true);
      for (const cb of state.callbacks)
        cb.onUpdate?.();
      filterInPlace(state.callbacks, cb => cb.once !== true);
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

/// Starting after this function returns, and until the returned `end` function is called
/// Any value read from a store will cause the given callback to be registered
/// to be called everytime these read values are modified
export function startStoreReadListen(cb: StoreReadCallback, options?: { once?: boolean }): { unsubscribe: () => void, end: () => void } {
  if (current_store_read_callback !== null)
    throw new Error("Recursive startStoreReadListen not supported");
  cb.once = options?.once ?? false;
  current_store_read_callback = cb;
  return {
    unsubscribe: () => {
      cb.is_stopped = true;
    },
    end: () => {
      if (current_store_read_callback !== cb)
        throw new Error("Invalid state after store read listen");
      current_store_read_callback = null;
    },
  };
}

export function untrack<T>(cb: () => T): T {
  const old_read_callback = current_store_read_callback;
  current_store_read_callback = null;
  const val = cb();
  current_store_read_callback = old_read_callback;
  return val;
}
