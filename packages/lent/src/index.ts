export { Component, type ComponentFactory } from "./component";
export { createStore, untrack, type Store, createSignal } from "./store";
export { createTask } from "./task";
export { For } from "./for";
export { startRuntime } from "./runtime";
export { serialize, deserialize } from "./serialize";

import { constructComponent, type Component, type ComponentFactory } from "./component";
import { immediateTrack } from "./task";
import { serialize, deserialize } from "./serialize";
import { isFunction } from "./utils";
import { signals, startStoreReadListen, stores, type StoreReadCallback } from "./store";

const SSRElementMarker = Symbol("ssr-element-marker");
export type SSRElement = { [SSRElementMarker]: true, t: string };
export type JSXElement = Node | number | string | null | undefined | JSXElement[] | ((previous?: JSXElement) => JSXElement) | SSRElement;
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
};

function isSSRElement(t: unknown): t is SSRElement {
  return typeof t === "object" && t !== null && SSRElementMarker in t && t[SSRElementMarker] === true;
}

type InfiniteFunction<A, B> = A | (() => InfiniteFunction<B, B>);
function fullCall<A, B>(n: InfiniteFunction<A, B>): A | B {
  if (isFunction(n))
    return fullCall(n());
  return n;
}

type NormalizedNode = string | Node | SSRElement;
function normalizeChildren(child: JSXElement): (NormalizedNode | ((previous?: JSXElement) => NormalizedNode[]))[] {
  if (child == null) return [];
  if (Array.isArray(child)) {
    return child.flatMap(normalizeChildren);
  }
  if (typeof child === "string" || typeof child === "number") {
    return [child.toString()];
  }
  if (isFunction(child)) {
    return [(previous) => normalizeChildren(child(previous)).flatMap(fullCall)];
  }
  return [child];
}

const nodify = (n: NormalizedNode): Node => {
  if (isSSRElement(n)) {
    const doc = new DOMParser().parseFromString(n.t, "text/html");
    if (doc.childNodes.length !== 1)
      throw new Error("Invalid number of element in ssr element");
    return doc.firstChild!;
  }
  else if (typeof n === "string") {
    return document.createTextNode(n);
  }
  else {
    return n;
  }
};
function addChild(parent: Node, child: JSXElement) {
  if (typeof document === "undefined")
    throw new Error("Called add_child not from a browser");

  const normalizedChildren = normalizeChildren(child);
  for (const child of normalizedChildren) {
    if (isFunction(child)) {
      const start_comment = new Comment("lentjs start");
      const end_comment = new Comment("lentjs end");

      immediateTrack(child, nodes => {
        parent.appendChild(start_comment);
        for (const subchild of nodes)
          parent.appendChild(nodify(subchild));
        parent.appendChild(end_comment);
      }, (new_nodes) => {
        const parentNodes = [...parent.childNodes];

        const s = parentNodes.indexOf(start_comment);
        const e = parentNodes.indexOf(end_comment);
        let current: Node = start_comment;
        for (let i = 0; i < new_nodes.length; i++) {
          const oldnode = s+i+1 < e ? parentNodes[s + i + 1] : null;
          const newnode = new_nodes[i]!;

          if (typeof newnode === "string" && oldnode instanceof Text) {
            oldnode.textContent = newnode;
            current = oldnode;
          }
          else if (oldnode === newnode) {
            // Do nothing
            current = newnode;
          }
          else {
            const n = nodify(newnode);
            if (oldnode) {
              parent.replaceChild(n, oldnode);
            }
            else {
              parent.insertBefore(n, current.nextSibling);
            }
            current = n;
          }
        }
        for (let i = new_nodes.length+s+1; i < e; i++) {
          parent.removeChild(parentNodes[i]!);
        }
      });
    }
    else {
      parent.appendChild(nodify(child));
    }
  }
}

function renderClasslist(list: ClassList): string[] {
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

function stringifyJSXElement(el: JSXElement): string {
  if (isSSRElement(el)) {
    return el.t;
  }
  else if (typeof el === "string" || typeof el === "number") {
    return el.toString();
  }
  else if (isFunction(el)) {
    return stringifyJSXElement(fullCall(el));
  }
  else if (Array.isArray(el)) {
    return el.map(stringifyJSXElement).join("");
  }
  else if (el == null) {
    return "";
  }
  else if (el instanceof Node) {
    throw new Error("Unsupported Node");
  }
  else {
    el satisfies never;
    throw new Error("Unreachable");
  }
}

export function renderToString(jsx: { new(props: {}): Component }): string {
  global_h_config = "ssr";
  const p = new jsx({});
  const el = stringifyJSXElement(p.render());

  const ser_signals: [string, any][] = [];
  for (const [id, { currentValue }] of signals.entries()) {
    ser_signals.push([id, currentValue]);
  }
  signals.clear();
  const signals_data = `<!--lentjs state signals ${serialize(ser_signals)}-->`;

  const ser_stores: [string, any][] = [];
  for (const [id, { obj }] of stores.entries()) {
    ser_stores.push([id, obj]);
  }
  stores.clear();
  const stores_data = `<!--lentjs state stores ${serialize(ser_stores)}-->`;

  return `${signals_data}${stores_data}${el}`;
}

function setAttribute(element: HTMLElement, name: string, value: AttributeValue) {
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
        t += `class="${renderClasslist(tv()).join(" ")}" `;
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
        const found_reads: NonNullable<StoreReadCallback["found_reads"]> = [];
        const { end } = startStoreReadListen({ found_reads });
        val = tv();
        end();

        t += `lentjs:attr:${tk}="${escapeHtmlAttribute(serialize({
          callback: tv,
          found_reads,
        }))}" `;
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
      return { [SSRElementMarker]: true, t: `<!--lentjs start ${comp.id} ${serialize({ props, state: constructed.state, })}-->${t}<!--lentjs end-->` };
    }
    else if (global_h_config === "dom") {
      return constructComponent(comp, props).render();
    }
    else {
      throw new Error("Invalid global_h_config value");
    }
  }
}
