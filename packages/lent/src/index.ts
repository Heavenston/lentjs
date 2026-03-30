export { Component, type ComponentFactory } from "./component";
export { createStore, untrack, type Store, createSignal } from "./store";
export { createTask } from "./task";
export { For } from "./for";
export { startRuntime } from "./runtime";
export { serialize, deserialize, closure } from "./serialize";

import { constructComponent, type Component, type ComponentFactory } from "./component";
import { immediateTrack } from "./task";
import { serialize } from "./serialize";
import { isFunction } from "./utils";
import { listenForStoreReads, signals, stores, type StoreRead } from "./store";
import { DIRECTIVE_PREFIX, type DirectiveName, type Directives, type MarkerDirectiveName } from "./runtime";
import { patchElement } from "./patchElement";

const SSRElementMarker = Symbol("ssr-element-marker");
export type SSRElement = { [SSRElementMarker]: true, t: string };
export type JSXElementSingular = SSRElement | ChildNode | number | string | null | undefined;
export type JSXElement = JSXElementSingular | JSXElement[] | ((previous?: JSXElement) => JSXElement);
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type EventHandler<E> = (event: E) => unknown;

type AttributeValue = string | boolean | number | undefined;
export type Attributes = {
  children?: JSXElement,
  class?: ClassList | (() => ClassList),
  value?: string | (() => string),
  checked?: boolean | (() => boolean),
} & {
  [key in `on:${string}`]?: EventHandler<Event>
} & {
  [key in `attr:${string}`]?: AttributeValue | (() => AttributeValue)
} & {
  [key in `prop:${string}`]?: () => any
};

export function isSSRElement(t: unknown): t is SSRElement {
  return typeof t === "object" && t !== null && SSRElementMarker in t && t[SSRElementMarker] === true;
}

function addChild(parent: Node, child: JSXElement) {
  patchElement(parent, null, child);
}

export function renderClasslist(list: ClassList): string[] {
  if (typeof list === "string") {
    return list.split(" ");
  }
  if (Array.isArray(list))
    return list.flatMap(renderClasslist);
  return Object.entries(list)
    .filter(([k, v]) => typeof k === "string" && v)
    .map(([k, _]) => k);
}

export function render(container: HTMLElement, jsx: { new(props: {}): Component }) {
  global_h_config = "dom";
  const p = new jsx({});
  const output = p.render();
  addChild(container, output);
}

function createDirective<K extends MarkerDirectiveName>(name: K): string;
function createDirective<K extends DirectiveName>(name: K, arg: Directives[K]): string;
function createDirective(name: string, arg: unknown = null): string {
  return `<!--${DIRECTIVE_PREFIX} ${name}${arg === null ? "" : " "+serialize(arg)}-->`;
}

function stringifyJSXElement(el: JSXElement, isInsideDynamic: boolean = false): string {
  if (isSSRElement(el)) {
    return el.t;
  }
  else if (typeof el === "string" || typeof el === "number") {
    return el.toString();
  }
  else if (isFunction(el)) {
    const [val, storeReads] = listenForStoreReads(() => el());
    if (storeReads.length <= 0) {
      return stringifyJSXElement(val, false);
    }
    const prefix = createDirective("start-dynamic", {
      storeReads,
      update: el,
    });
    const suffix = createDirective("end-dynamic");
    return `${prefix}${stringifyJSXElement(val, true)}${suffix}`;
  }
  else if (Array.isArray(el)) {
    if (!isInsideDynamic) {
      return el.map(e => stringifyJSXElement(e, isInsideDynamic)).join("");
    }

    const t = el.map(e => stringifyJSXElement(e, isInsideDynamic)).join(createDirective("array-element-separator"));
    const prefix = createDirective("start-array");
    const suffix = createDirective("end-array");
    return `${prefix}${t}${suffix}`;
  }
  else if (el == null) {
    if (!isInsideDynamic) {
      return "";
    }

    return createDirective("null", null);
  }
  else if (el instanceof Node) {
    throw new Error("Unsupported Node");
  }
  else {
    el satisfies never;
    throw new Error("Unreachable");
  }
}

export function renderToString(jsx: ComponentFactory<{}, any, any>): string {
  signals.clear();
  stores.clear();

  global_h_config = "ssr";
  try {
    const el = stringifyJSXElement(h(jsx));

    const ser_stores: [string, any][] = [];
    for (const [id, { obj }] of stores.entries()) {
      ser_stores.push([id, obj]);
    }
    const stores_data = createDirective("stores", ser_stores);

    const ser_signals: [string, any][] = [];
    for (const [id, { currentValue }] of signals.entries()) {
      ser_signals.push([id, currentValue]);
    }
    const signals_data = createDirective("signals", ser_signals);

    return `${stores_data}${signals_data}${el}`;
  }
  catch(e) {
    throw e;
  }
  finally {
    global_h_config = "dom";
  }
}

export function setAttribute(element: HTMLElement, name: string, value: AttributeValue) {
  if (value !== undefined && value !== false)
    element.setAttribute(name, value.toString());
  else
    element.removeAttribute(name);
}
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function createHTMLElement(element: string, props: Attributes): HTMLElement {
  const el = document.createElement(element);
  for (const [k, v] of Object.entries(props)) {
    if (k === "children") {
      const tv = v as Attributes["children"];
      addChild(el, tv);
    }
    else if (k === "class") {
      const tv = v as Attributes["class"];
      if (typeof tv === "string")
        el.className = tv;
      else if (typeof tv === "function") {
        immediateTrack(tv, (class_list) => {
          el.className = "";
          el.classList.add(...renderClasslist(class_list));
        });
      }
      else if(tv)
        el.classList.add(...renderClasslist(tv));
    }
    else if (k === "value") {
      const tv = v as Attributes["value"];
      if (isFunction(tv)) {
        immediateTrack(tv, (value) => {
          // @ts-ignore
          el.value = value;
        });
      }
      else {
        // @ts-ignore
        el.value = tv;
      }
    }
    else if (k === "checked") {
      const tv = v as Attributes["checked"];
      if (isFunction(tv)) {
        immediateTrack(tv, (checked) => {
          // @ts-ignore
          el.checked = checked;
        });
      }
      else {
        // @ts-ignore
        el.checked = tv;
      }
    }
    else if (k.startsWith("on:")) {
      const tv = v as Attributes[`on:${string}`];
      const tk = k.replace(/^on:/, "");
      if (tv !== undefined)
        el.addEventListener(tk, tv);
      else
        el.removeAttribute(tk);
    }
    else if (k.startsWith("attr:")) {
      const tv = v as Attributes[`attr:${string}`];
      const tk = k.replace(/^attr:/, "");

      if (isFunction(tv)) {
        immediateTrack(tv, (value) => {
          setAttribute(el, tk, value);
        });
      }
      else {
        setAttribute(el, tk, tv);
      }
    }
    else if (k.startsWith("prop:")) {
      const tv = v as Attributes[`prop:${string}`];
      const tk = k.replace(/^prop:/, "");

      if (isFunction(tv)) {
        immediateTrack(tv, (value) => {
          // @ts-ignore
          el[tk] = value;
        });
      }
      else {
        // @ts-ignore
        el[tk] = value;
      }
    }
    else {
      throw new Error(`Unsupported attribute ${k}`);
    }
  }
  return el;
}
function createSSRElement(element: string, props: Attributes): SSRElement {
  let t = `<${element} `;
  let children: Attributes["children"] = null;
  for (const [k, v] of Object.entries(props)) {
    if (k === "children") {
      const tv = v as Attributes["children"];
      children = tv;
    }
    else if (k === "class") {
      const tv = v as Attributes["class"];
      if (typeof tv === "string")
        t += `class="${tv}" `;
      else if (typeof tv === "function") {
        const [class_list, found_reads] = listenForStoreReads(tv);
        t += `class="${renderClasslist(class_list).join(" ")}" `;
        if (found_reads.length > 0) {
          t += `lentjs:class="${escapeHtmlAttribute(serialize({
            found_reads,
            update: tv,
          }))}" `;
        }
      }
      else if(tv)
        t += `class="${renderClasslist(tv).join(" ")}" `;
    }
    else if (k === "value") {
      const tv = v as Attributes["value"];
      if (isFunction(tv)) {
        t += `value="${tv()}" `;
      }
      else if (tv !== undefined) {
        t += `value="${tv}" `;
      }
    }
    else if (k === "checked") {
      const tv = v as Attributes["checked"];
      if (isFunction(tv)) {
        if (tv())
          t += `checked `;
      }
      else if (tv !== undefined && tv === true)
        t += `checked `;
    }
    else if (k.startsWith("on:")) {
      const tv = v as Attributes[`on:${string}`];
      const tk = k.replace(/^on:/, "");
      if (tv !== undefined)
        t += `lentjs:on:${tk}="${escapeHtmlAttribute(serialize(tv))}" `;
    }
    else if (k.startsWith("attr:")) {
      const tv = v as Attributes[`attr:${string}`];
      const tk = k.replace(/^attr:/, "");

      let val: AttributeValue;

      if (isFunction(tv)) {
        let found_reads: StoreRead[];
        [val, found_reads] = listenForStoreReads(tv);
        if (found_reads.length > 0) {
          t += `lentjs:attr:${tk}="${escapeHtmlAttribute(serialize({
            callback: tv,
            found_reads,
          }))}" `;
        }
      }
      else {
        val = tv;
      }

      if (val === true) {
        t += `${tk} `;
      }
      else if (val !== undefined && val !== false) {
        t += `${tk}="${escapeHtmlAttribute(val.toString())}" `;
      }
    }
    else if (k.startsWith("prop:")) {
      const tv = v as Attributes[`prop:${string}`];
      const tk = k.replace(/^prop:/, "");

      let val: AttributeValue;

      if (isFunction(tv)) {
        let found_reads: StoreRead[];
        [val, found_reads] = listenForStoreReads(tv);
        if (found_reads.length > 0) {
          t += `lentjs:prop:${tk}="${escapeHtmlAttribute(serialize({
            callback: tv,
            found_reads,
          }))}" `;
        }
      }
      else {
        val = tv;
      }

      // if (val === true) {
      //   t += `${tk} `;
      // }
      // else if (val !== undefined && val !== false) {
      //   t += `${tk}="${escapeHtmlAttribute(val.toString())}" `;
      // }
    }
    else {
      throw new Error(`Unsupported attribute ${k}`);
    }
  }
  t += `>`;
  t += stringifyJSXElement(children);
  t += `</${element}>`;
  return { [SSRElementMarker]: true, t };
}

let global_h_config: "ssr" | "dom" = "dom";

export function h(element: string, props?: Attributes): JSXElement;
export function h(element: ComponentFactory<{}, any, any>): JSXElement;
export function h<P>(element: ComponentFactory<P, any, any>, props: P): JSXElement;
export function h(element: any, props: any = {}): JSXElement {
  if (typeof element === "string") {
    if (global_h_config === "ssr") {
      return createSSRElement(element, props);
    }
    else if (global_h_config === "dom") {
      return createHTMLElement(element, props);
    }
    else {
      throw new Error("Invalid global_h_config value");
    }
  }
  // is a component factory
  else {
    const comp: ComponentFactory<{}, any, any> = element;
    if (global_h_config === "ssr") {
      const constructed = constructComponent(comp, props);
      const t = stringifyJSXElement(constructed.render());
      return {
        [SSRElementMarker]: true,
        t: `${createDirective("start-component", {
          factoryId: comp.id,
          componentId: constructed.id,
          props,
          state: constructed.state,
        })}${t}${createDirective("end-component")}`,
      };
    }
    else if (global_h_config === "dom") {
      return constructComponent(comp, props).render();
    }
    else {
      throw new Error("Invalid global_h_config value");
    }
  }
}
