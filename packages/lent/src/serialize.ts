import * as devalue from "devalue";
import { Component } from ".";
import { isFunction } from "./utils";
import { isSignalAccessor, isSignalSetter, signalAccessorFromId, signalSetterFromId } from "./store";

const isClassMethodSymbol = Symbol("is-class-method-symbol");

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

export function serialize(value: unknown): string {
  const cf = getComponentFunctions();
  return devalue.stringify(value, {
    componentFunction: (f: unknown) => {
      if (!isFunction(f)) return;
      return cf.function_to_name.get(f);
    },
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
      if (isFunction(f)) return f.toString();
    },
  });
}

export function deserialize(text: string): unknown {
  return devalue.parse(text, {
    componentFunction: f => {
      return getComponentFunctions().name_to_function.get(`${f[0]} ${f[1]}`);
    },
    signalAccessor: (id: string) => {
      return signalAccessorFromId(id);
    },
    signalSetter: (id: string) => {
      return signalSetterFromId(id);
    },
    closure: f => {
      return (new Function(`return ${f}`))();
    },
  });
}

export function isClassMethod(val: unknown): boolean {
  // @ts-ignore
  return val[isClassMethodSymbol] === true;
}
