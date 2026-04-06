import * as devalue from "devalue";
import { assert, isFunction, isObject } from "@lentjs/utils";

const isClassMethodSymbol = Symbol("is-class-method-symbol");

const closureDataSymbol = Symbol("closure-data");
type ClosureData = {
  og_function: () => unknown,
  thisarg?: unknown,
  values: readonly unknown[],
};
export type Closure<F extends () => any> = F & { [closureDataSymbol]: ClosureData };
export function closure<A extends any[], B extends any[], R>(og_fn: (...args: [...A, ...B]) => R, ...values: A): Closure<(...args: B) => R> {
  return bind(og_fn, null, ...values);
}

export function bind<A extends any[], B extends any[], T, R>(og_fn: (this: T, ...args: [...A, ...B]) => R, thisarg: T, ...values_: A): Closure<(...args: B) => R> {
  const values = Object.freeze(Array.from(values_) as A);
  const nfn: Closure<(...args: B) => R> = Function.prototype.bind.call(og_fn, thisarg, ...values) as any;
  Object.defineProperties(nfn, {
    [closureDataSymbol]: {
      value: Object.freeze({
        og_function: og_fn,
        values,
        thisarg,
      } satisfies ClosureData),
      enumerable: true,
    },
    bind: { configurable: true, value: thisBind },
  });
  return nfn;
}

/// Rust a wrapper around bind that calls it with `this` as the first argument
function thisBind<A extends any[], B extends any[], T, R>(this: (this: T, ...args: [...A, ...B]) => R, thisarg: T, ...values: A): (...args: B) => R {
  return bind(this, thisarg, ...values);
}

export function isClosure<F extends () => any>(value: F): value is Closure<F> {
  return closureDataSymbol in value;
}

const registry = new Map<string, unknown>;
const registryIdSymbol = Symbol("registry-id");
export function register<V extends object>(value: V, id: string): V {
  if (registryIdSymbol in value) { return value; }
  if (registry.has(id)) { console.warn("Duplicate registry id", id) }
  registry.set(id, value);
  Object.defineProperty(value, registryIdSymbol, { enumerable: true, value: id });
  if (isFunction(value) && !isClosure(value)) {
    Object.defineProperty(value, "bind", { configurable: true, value: thisBind });
  }
  return value;
}
register(register, "__lentjs_register");
register(bind, "__lentjs_bind");
register(closure, "__lentjs_closure");

export function getValueRegistryId(value: unknown): string | null {
  if (isObject(value) && registryIdSymbol in value)
    return value[registryIdSymbol] as string ?? null;
  return null;
}

export const definedSerializationSymbol = Symbol("serialization");
export type DefinedSerializationData<O = unknown, A = unknown> = [reducer: (val: O) => A, reviver: (data: A) => O];
export function defineSerialization<O, A>(value: O, ...[reducer, reviver]: DefinedSerializationData<O, A>) {
  Object.defineProperty(value, definedSerializationSymbol, { value: [reducer, reviver] });
}

const devalueReducers: Record<string, (value: any) => any> = {
  reg: (val: unknown) => getValueRegistryId(val) ?? undefined,
  clo: (f: unknown) => {
    if (isFunction(f) && isClosure(f)) {
      const data = f[closureDataSymbol];
      return [data.og_function, data.values, data.thisarg];
    }
  },
  rec: (val: unknown) => {
    if (isObject(val) && definedSerializationSymbol in val) {
      const [reducer, reviver] = val[definedSerializationSymbol] as DefinedSerializationData;
      return [reducer(val), reviver];
    }
  },
  fun: (f: unknown) => {
    if (isFunction(f)) {
      throw new Error(`Cannot stringify function ${f}`);
    }
  },
};

const devalueRevivers: Record<string, (value: any) => any> = {
  reg: (id: string) => {
    assert(registry.has(id), `No values in registry with id '${id}'`);
    return registry.get(id);
  },
  clo: ([og_function, values, thisarg]: [ClosureData["og_function"], ClosureData["values"], ClosureData["thisarg"]]) => {
    return og_function.bind(thisarg, ...values);
  },
  rec: ([val, reviver]: [unknown, DefinedSerializationData[1]]) => {
    return reviver(val);
  },
};

export function serialize(value: unknown): string {
  return devalue.stringify(value, devalueReducers);
}

export function deserialize(text: string): unknown {
  return devalue.parse(text, devalueRevivers);
}

export function isClassMethod(val: unknown): boolean {
  // @ts-ignore
  return val[isClassMethodSymbol] === true;
}
