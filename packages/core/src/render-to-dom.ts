import { createTask, getScope, Scope, untrack } from "@lentjs/core-reactivity";
import { cleanupStateNodes, patchElement } from "./patch-element";
import { factory } from "./factory";
import type { ComponentFn } from ".";
import { getHandlerForAttribute } from "./attributes";

export function createHTMLElement(element: string, props: any): HTMLElement {
  const el = document.createElement(element);
  for (const propName of Object.keys(props)) {
    if (propName === "children") {
      const state = patchElement(el, null, null, () => props[propName]);
      getScope().onCleanup(() => cleanupStateNodes(state));
      continue;
    }

    const attrHandler = getHandlerForAttribute(propName);
    if (attrHandler === null) continue;
    createTask(() => {
      const val = props[propName];
      untrack(() => {
        attrHandler.setOnHTMLElement(el, propName, val);
      });
    });
  }
  return el;
}

export function renderToDom(parent: Node, el: ComponentFn<object>): void {
  Scope.create().enter(() => {
    const val = patchElement(parent, null, null, factory(el));
    // @ts-expect-error This is useless and just used to prevent val from being gced
    globalThis[Symbol("gc-prevention")] = val;
  });
}
