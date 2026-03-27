const is_store = Symbol("is_store");
export type Store<S> = S & { [is_store]: true };

export type StoreReadCallback = (() => void) & { is_stopped?: boolean, once?: boolean };

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

let current_store_read_callback: StoreReadCallback | null = null;
export function createStore<S extends object>(initialValue: S): Store<S> {
  let prop_callbacks = new Map<string | symbol, StoreReadCallback[]>;
  return new Proxy<any>({ ...initialValue }, {
    set: (obj, prop, value) => {
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
      if (current_store_read_callback !== null) {
        const prop_array = prop_callbacks.get(prop) ?? prop_callbacks.set(prop, []).get(prop)!;
        prop_array.push(current_store_read_callback);
      }
      return obj[prop];
    },
  });
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
