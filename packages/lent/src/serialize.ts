import * as devalue from "devalue";
import { Component } from ".";
import { isFunction } from "./utils";

let component_functions: {
  function_to_name: Map<any, [string, string]>,
  name_to_function: Map<`${string} ${string}`, any>,
} | null = null;
function getComponentFunctions(): NonNullable<typeof component_functions> {
  if (component_functions)
    return component_functions;
  component_functions = {
    function_to_name: new Map,
    name_to_function: new Map,
  };

  for (const comp of Component.listComponents()) {
    const methods = Object.getOwnPropertyNames(comp.prototype);
    for (const method of methods) {
      if (isFunction(comp.prototype[method])) {
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
    componentFunction: (f) => {
      return cf.function_to_name.get(f);
    },
    closure: f => {
      if (isFunction(f)) return f.toString();
    },
  });
}

export function deserialize(text: string): unknown {
  return devalue.parse(text, {
    componentFunction: f => {
      console.log("componentFunction", f);
    },
    closure: f => {
      return (new Function(`return ${f}`))();
    },
  });
}
