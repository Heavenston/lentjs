import * as devalue from "devalue";
import { Component } from ".";
import { isFunction } from "./utils";
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
  const nfn: Closure<(...args: B) => R> = (...args: B): R => {
    return og_fn.call(thisarg, ...values, ...args);
  };
  nfn[isClosureSymbol] = true;
  nfn.og_function = og_fn;
  nfn.thisarg = thisarg;
  nfn.values = values;
  return nfn
}

export function isClosure<F extends () => any>(value: F): value is Closure<F> {
  return isClosureSymbol in value && value[isClosureSymbol] === true;
}

let component_functions: {
  done_components: Set<any>,
  function_to_name: Map<any, [string, string]>,
  name_to_function: Map<`${string} ${string}`, any>,
} | null = null;
function getComponentFunctions(): NonNullable<typeof component_functions> {
  if (!component_functions)
    component_functions = {
      done_components: new Set,
      function_to_name: new Map,
      name_to_function: new Map,
    };

  for (const comp of Component.listComponents()) {
    if (component_functions.done_components.has(comp)) continue;
    component_functions.done_components.add(comp);

    const methods = Object.getOwnPropertyNames(comp.prototype);
    for (const method of methods) {
      if (isFunction(comp.prototype[method])) {
        // @ts-ignore
        comp.prototype[method][isClassMethodSymbol] = true;
        component_functions.function_to_name.set(comp.prototype[method], [comp.id, method]);
        component_functions.name_to_function.set(`${comp.id} ${method}`, comp.prototype[method]);
      }
    }
  }
  
  return component_functions;
}

const devalueReducers: Record<string, (value: any) => any> = {
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
      };
    }
  },
  component: (f: unknown) => {
    if (f instanceof Component) return f.id;
  },
  store: (f: unknown) => {
    if (isStore(f)) return getStoreId(f);
  },
};
const extendedDevalueReducers: Record<string, (value: any) => any> = {
  componentFunction: (f: unknown) => {
    if (!isFunction(f)) return;
    return getComponentFunctions().function_to_name.get(f);
  },
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
  componentFunction: f => {
    return getComponentFunctions().name_to_function.get(`${f[0]} ${f[1]}`);
  },
  signalAccessor: (id: string) => {
    return signalAccessorFromId(id);
  },
  signalSetter: (id: string) => {
    return signalSetterFromId(id);
  },
  closure: ({ code, thisarg, values }: { code: string, thisarg: unknown, values: Array<unknown> }) => {
    const fn = deserialize(code) as Function;
    return (...args: unknown[]) => fn.call(thisarg, ...values, ...args);
  },
  component: (id: string) => {
    return createLazyProxy(() => {
      const instance = Component.getInstanceFromId(id);
      if (instance === null) throw new Error(`No component instance with id ${id}`);
      return instance;
    });
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
