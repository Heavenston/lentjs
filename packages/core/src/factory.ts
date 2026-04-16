import type { Attributes, ComponentFn, JSXElement } from ".";
import { Scope, untrack } from "@lentjs/core-reactivity";
import { register } from "@lentjs/core-serialize";
import { createHTMLElement } from "./render-to-dom";
import { createSSRElement } from "./render-to-string";

export function factory(element: string, props?: Attributes): JSXElement;
export function factory(element: ComponentFn<{}>): JSXElement;
export function factory<P>(element: ComponentFn<P>, props: P): JSXElement;
export function factory<P>(element: string | ComponentFn<P>, props?: P): JSXElement {
  if (typeof element === "string") {
    if (typeof document === "undefined") {
      return untrack(()=>createSSRElement(element, props ?? {}));
    }
    else {
      return untrack(()=>createHTMLElement(element, props ?? {}));
    }
  }
  else {
    return {
      withScope: Scope.create(),
      fun: element.bind(null, props!),
    };
  }
}
register(factory, "__lentjs_factory");

