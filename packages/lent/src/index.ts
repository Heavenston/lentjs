export { createStore, untrack, type Store, createSignal, type SignalSetter, type SignalAccessor } from "./store";
export { createTask } from "./task";
export { For } from "./for";
export { RefFor } from "./ref-for";
export { startRuntime } from "./runtime";
export { serialize, deserialize, closure, bind, register } from "./serialize";
export { Fragment } from "./fragment";

import { immediateTrack } from "./task";
import { register, serialize } from "./serialize";
import { isFunction } from "./utils";
import { listenForStoreReads, signals, stores, untrack, type StoreRead } from "./store";
import { DIRECTIVE_PREFIX, type DirectiveName, type Directives, type DynamicValueData, type MarkerDirectiveName } from "./runtime";
import { patchElement } from "./patchElement";
import { escapeHtml } from "./escape-html";

register(untrack, "__lentjs_untrack");
register(h, "__lentjs_h");

const SSRElementMarker = Symbol("ssr-element-marker");
export type SSRElement = { [SSRElementMarker]: true, t: string };
export type JSXElementString = number | string;
export type JSXElementSingular = SSRElement | ChildNode | JSXElementString | null | undefined;
export type JSXElementArray = JSXElement[];
export type JSXElementDynamic = (previous?: JSXElement) => JSXElement;
export type JSXElement = JSXElementSingular | JSXElementArray | JSXElementDynamic;
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type ComponentFn<P> = (props: P) => JSXElement;

export type EventHandler<E> = (event: E) => unknown;

export type AttributeValue = string | boolean | number | undefined;
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

export function isJSXElementString(t: unknown): t is JSXElementString {
  return typeof t === "string" || typeof t === "number";
}

function addChild(parent: Node, child: JSXElement) {
  patchElement(parent, null, null, child);
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

let global_h_config: "ssr" | "dom" = "dom";
const global_directive_data_array: unknown[] = [];

function sharedSSRSerialize(value: unknown): number {
  const idx = global_directive_data_array.length;
  global_directive_data_array.push(value);
  return idx;
}

function createSSRDirective<K extends MarkerDirectiveName>(name: K): string;
function createSSRDirective<K extends DirectiveName>(name: K, arg: Directives[K], embed?: boolean): string;
function createSSRDirective(name: string, arg: unknown = null, embed: boolean = false): string {
  if (arg === null) {
    return `<!--${DIRECTIVE_PREFIX} ${name}-->`;
  }
  else {
    return `<!--${DIRECTIVE_PREFIX} ${name} ${embed ? serialize(arg) : sharedSSRSerialize(arg)}-->`;
  }
}

function stringifyJSXElement(el: JSXElement, isInsideDynamic: boolean = false): string {
  if (isSSRElement(el)) {
    return el.t;
  }
  else if (isJSXElementString(el)) {
    return escapeHtml(el.toString());
  }
  else if (isFunction(el)) {
    const [val, storeReads] = listenForStoreReads(() => el());
    if (storeReads.length <= 0 && !isInsideDynamic) {
      return stringifyJSXElement(val, false);
    }
    const prefix = createSSRDirective("dyn", {
      storeReads,
      update: el,
    });
    const suffix = createSSRDirective("dyn/");
    return `${prefix}${stringifyJSXElement(val, true)}${suffix}`;
  }
  else if (Array.isArray(el)) {
    if (!isInsideDynamic) {
      return el.map(e => stringifyJSXElement(e, false)).join("");
    }

    const t = el.map(e => stringifyJSXElement(e, true)).join(createSSRDirective("sep"));
    const prefix = createSSRDirective("arr");
    const suffix = createSSRDirective("arr/");
    return `${prefix}${t}${suffix}`;
  }
  else if (el === null) {
    return isInsideDynamic ? createSSRDirective("nul", null) : "";
  }
  else if (el === undefined) {
    return isInsideDynamic ? createSSRDirective("und", null) : "";
  }
  else if (el instanceof Node) {
    throw new Error("Unsupported Node");
  }
  else {
    el satisfies never;
    throw new Error("Unreachable");
  }
}

export function renderToString(el: ComponentFn<{}>): string {
  signals.clear();
  stores.clear();
  global_directive_data_array.length = 0;

  global_h_config = "ssr";
  try {
    const t = stringifyJSXElement(h(el));

    const ser_stores: [string, any][] = [];
    for (const [id, { obj }] of stores.entries()) {
      ser_stores.push([id, obj]);
    }
    const stores_data = createSSRDirective("stores", ser_stores);

    const ser_signals: [string, any][] = [];
    for (const [id, { currentValue }] of signals.entries()) {
      ser_signals.push([id, currentValue]);
    }
    const signals_data = createSSRDirective("signals", ser_signals);

    const directives_data = createSSRDirective("directives-data", global_directive_data_array, true);

    return `${directives_data}${stores_data}${signals_data}${t}`;
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
          t += `${DIRECTIVE_PREFIX}:class="${sharedSSRSerialize([found_reads, tv] satisfies DynamicValueData<ClassList>)}" `;
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
        t += `${DIRECTIVE_PREFIX}:on:${tk}="${sharedSSRSerialize(tv)}" `;
    }
    else if (k.startsWith("attr:")) {
      const tv = v as Attributes[`attr:${string}`];
      const tk = k.replace(/^attr:/, "");

      let val: AttributeValue;

      if (isFunction(tv)) {
        let found_reads: StoreRead[];
        [val, found_reads] = listenForStoreReads(tv);
        if (found_reads.length > 0) {
          t += `${DIRECTIVE_PREFIX}:attr:${tk}="${sharedSSRSerialize([found_reads, tv] satisfies DynamicValueData<AttributeValue>)}" `;
        }
      }
      else {
        val = tv;
      }

      if (val === true) {
        t += `${tk} `;
      }
      else if (val !== undefined && val !== false) {
        t += `${tk}="${escapeHtml(val.toString())}" `;
      }
    }
    else if (k.startsWith("prop:")) {
      const tv = v as Attributes[`prop:${string}`];
      const tk = k.replace(/^prop:/, "");

      if (isFunction(tv)) {
        const [_val, found_reads] = listenForStoreReads(tv);
        if (found_reads.length > 0) {
          t += `${DIRECTIVE_PREFIX}:prop:${tk}="${sharedSSRSerialize([found_reads, tv] satisfies DynamicValueData<ClassList>)}" `;
        }
      }

      // FIXME: prop: cannot be SSRd, or can it?
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

const hComponent = register(<P>(component: ComponentFn<P>, props: P): JSXElement => {
  return untrack(() => component(props));
}, "__lentjs_hcomponent");

export function h(element: string, props?: Attributes): JSXElement;
export function h(element: ComponentFn<{}>): JSXElement;
export function h<P>(element: ComponentFn<P>, props: P): JSXElement;
export function h<P>(element: string | ComponentFn<P>, props?: P): JSXElement {
  if (typeof element === "string") {
    if (global_h_config === "ssr") {
      return createSSRElement(element, props ?? {});
    }
    else if (global_h_config === "dom") {
      return createHTMLElement(element, props ?? {});
    }
    else {
      throw new Error("Invalid global_h_config value");
    }
  }
  else {
    return (hComponent<P>).bind(null, element, props!);
  }
}
