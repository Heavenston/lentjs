import * as devalue from "devalue";
import { assert, isFunction } from "./utils";
import { getStoreId, isSignalAccessor, isSignalSetter, isStore, signalAccessorFromId, signalSetterFromId, storeFromId } from "./store";
import { createLazyProxy } from "./lazy-proxy";

const isClassMethodSymbol = Symbol("is-class-method-symbol");

const isClosureSymbol = Symbol("closure");
export type Closure<F extends () => any> = F & {
  [isClosureSymbol]: true,
  og_function: () => unknown,
  thisarg?: unknown,
  values: unknown[],
};
export function closure<A extends any[], B extends any[], R>(og_fn: (...args: [...A, ...B]) => R, ...values: A): Closure<(...args: B) => R> {
  return bind(og_fn, null, ...values);
}

export function bind<A extends any[], B extends any[], T, R>(og_fn: (this: T, ...args: [...A, ...B]) => R, thisarg: T, ...values: A): Closure<(...args: B) => R> {
  // Created inside an object so that its 'name' is the same of the og_fn
  // FIXME: Any other way?
  const nfn: Closure<(...args: B) => R> = {
    [og_fn.name](...args: B): R {
      return og_fn.call(thisarg, ...values, ...args);
    },
  }[og_fn.name] as any;
  nfn[isClosureSymbol] = true;
  nfn.og_function = og_fn;
  nfn.thisarg = thisarg;
  nfn.values = values;
  return nfn;
}

export function isClosure<F extends () => any>(value: F): value is Closure<F> {
  return isClosureSymbol in value && value[isClosureSymbol] === true;
}

const registry = new Map<string, unknown>;
const registryIdSymbol = Symbol("registry-id");
export function register<V extends object>(value: V, id: string): V {
  assert(!registry.has(id), "Duplicate registry id");
  assert(!(registryIdSymbol in value), "Value already registered");
  registry.set(id, value);
  Object.defineProperty(value, registryIdSymbol, {
    writable: false,
    value: id,
  });
  return value;
}

export function getValueRegistryId(value: unknown): string | null {
  if (typeof value === "object" && value !== null && registryIdSymbol in value)
    return value[registryIdSymbol] as string;
  return null;
}

const devalueReducers: Record<string, (value: any) => any> = {
  registered: (val: unknown) => getValueRegistryId(val) ?? undefined,
  signalAccessor: (f: unknown) => {
    if (isSignalAccessor(f)) {
      return f.signalId;
    }
  },
  signalSetter: (f: unknown) => {
    if (isSignalSetter(f)) {
      return f.signalId;
    }
  },
  closure: (f: unknown) => {
    if (isFunction(f) && isClosure(f)) {
      return {
        code: devalue.stringify(f.og_function, extendedDevalueReducers),
        thisarg: f.thisarg,
        values: f.values,
        name: f.name,
      };
    }
  },
  store: (f: unknown) => {
    if (isStore(f)) return getStoreId(f);
  },
};
const extendedDevalueReducers: Record<string, (value: any) => any> = {
  ...devalueReducers,
  function: (f: unknown) => {
    if (isFunction(f)) {
      return f.toString();
    }
  },
};
const limitedDevalueReducers: Record<string, (value: any) => any> = {
  ...devalueReducers,
  function: (f: unknown) => {
    if (isFunction(f)) {
      throw new Error(`Cannot stringify function ${f}`);
    }
  },
};

const devalueRevivers: Record<string, (value: any) => any> = {
  registered: (id: string) => {
    assert(registry.has(id), `No values in registry with id '${id}'`);
    return registry.get(id);
  },
  signalAccessor: (id: string) => {
    return signalAccessorFromId(id);
  },
  signalSetter: (id: string) => {
    return signalSetterFromId(id);
  },
  closure: ({ name, code, thisarg, values }: { name: string, code: string, thisarg: unknown, values: Array<unknown> }) => {
    const fn = deserialize(code) as Function;
    // Created inside an object so that we can chose its 'name'
    // FIXME: Any other way?
    return {
      [name](...args: unknown[]) { return fn.call(thisarg, ...values, ...args) },
    }[name];
  },
  function: (code: string) => {
    return eval(code);
  },
  store: (id) => {
    return createLazyProxy(() => {
      const store = storeFromId(id);
      if (store === null)
        throw new Error(`No store with id ${id}`);
      return store;
    });
  },
};

export function serialize(value: unknown): string {
  return devalue.stringify(value, limitedDevalueReducers);
}

export function deserialize(text: string): unknown {
  return devalue.parse(text, devalueRevivers);
}

export function isClassMethod(val: unknown): boolean {
  // @ts-ignore
  return val[isClassMethodSymbol] === true;
}
