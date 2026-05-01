import { definedSerializationSymbol, register } from "@lentjs/core-serialize";
import { triggerSignalCallbacks, triggerSignalRead } from "./signal-internal";
import { createUid } from "@lentjs/utils";

const storeIdSymbol: unique symbol = Symbol("store");
export type Store<S> = S & { [storeIdSymbol]: string };

const storeReviver = register(([storeId, obj]: [string, object]) => {
  return resumeStore(storeId, obj);
}, "__lentjs_storeReviver");
function resumeStore<S extends object>(storeId: string, obj: S): Store<S> {
  /* eslint-disable @typescript-eslint/no-unsafe-member-access,
                    @typescript-eslint/no-unsafe-assignment,
                    @typescript-eslint/no-unsafe-return */

  return new Proxy<any>(obj, {
    has: (obj, prop) => {
      return prop === storeIdSymbol ||
        prop === definedSerializationSymbol ||
        prop in obj;
    },
    set: (obj, prop, value) => {
      if (prop === storeIdSymbol) { return false; }
      if (typeof prop === "symbol") throw new Error("Symbol keys inside store are not supported");

      const changed = obj[prop] !== value;
      obj[prop] = value;
      if (changed)
        triggerSignalCallbacks(`${storeId}_${prop}`)
      return true;
    },
    get(obj, prop) {
      if (prop === storeIdSymbol) { return storeId; }
      if (prop === definedSerializationSymbol) {
        return [() => [storeId, obj], storeReviver];
      }
      if (typeof prop === "symbol") throw new Error("Symbol keys inside store are not supported");

      triggerSignalRead(`${storeId}_${prop}`);
      return obj[prop];
    },
  }) as Store<S>;
}

export function createStore<S extends object>(obj: S): Store<S> {
  return resumeStore(createUid(), obj);
}

export function isStore<S>(s: S): s is Store<S> {
  return typeof s === "object" && s !== null && storeIdSymbol in s;
}

export function getStoreId(store: Store<unknown>): string {
  return store[storeIdSymbol];
}
