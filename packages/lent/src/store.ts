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
export type Store<S> = S & { [isStoreSymbol]: true, [storeIdSymbol]: string };
export type StoreReadCallback = (() => void) & { is_stopped?: boolean, once?: boolean };

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
            cb();
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
        prop_array.push(current_store_read_callback);
      }

      return obj[prop];
    },
  });
}

export function getStoreId(store: Store<unknown>): string {
  return store[storeIdSymbol];
}

const signalAccessorSymbol = Symbol("signal-accessor");
const signalSetterSymbol = Symbol("signal-setter");
export type SignalState = { signalId: string };
export type SignalAccessor<V> = (() => V) & { [signalAccessorSymbol]: true } & SignalState;
export type SignalSetter<V> = ((new_val: V) => void) & { [signalSetterSymbol]: true } & SignalState;
export function createSignal<V>(initialValue: V): [SignalAccessor<V>, SignalSetter<V>] {
  const id = crypto.randomUUID();

  let value = initialValue;
  let callbacks: StoreReadCallback[] = [];

  const accessor: SignalAccessor<V> = () => {
    if (current_store_read_callback !== null) {
      callbacks.push(current_store_read_callback);
    }
    return value;
  };
  accessor[signalAccessorSymbol] = true;
  accessor.signalId = id;
  const setter: SignalSetter<V> = (new_value: V) => {
    const changed = new_value !== value;
    value = new_value;

    if (changed) {
      filterInPlace(callbacks, cb => cb.is_stopped !== true);
      for (const cb of callbacks)
        cb();
      filterInPlace(callbacks, cb => cb.once !== true);
    }
  };
  setter[signalSetterSymbol] = true;
  setter.signalId = id;

  return [accessor, setter];
}

export function isSignalAccessor(val: unknown): val is SignalAccessor<unknown> {
  return typeof val === "object" && val !== null && signalAccessorSymbol in val && val[signalAccessorSymbol] === true;
}

export function isSignalSetter(val: unknown): val is SignalSetter<never> {
  return typeof val === "object" && val !== null && signalSetterSymbol in val && val[signalSetterSymbol] === true;
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
