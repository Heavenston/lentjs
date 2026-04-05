export { createStore, untrack, type Store, createSignal, type SignalSetter, type SignalAccessor } from "./store";
export { createTask } from "./task";
export { For } from "./for";
export { RefFor } from "./ref-for";
export { startRuntime } from "./runtime";
export { serialize, deserialize, closure, bind, register } from "./serialize";
export { Fragment } from "./fragment";
export { type Attributes, type AttributeValue } from "./attributes";
export { type SSRElement, isSSRElement } from "./ssr-element";

import { register, serialize } from "./serialize";
import { isFunction, microtaskDebounce } from "./utils";
import { listenForStoreReads, signals, stores, subscribeToStoreReads, untrack, type StoreRead } from "./store";
import { DIRECTIVE_PREFIX, type ResumeAttributesData, type DirectiveName, type Directives, type DynamicAttributesData, type MarkerDirectiveName, ATTRIBUTE_PREFIX } from "./runtime";
import { escapeHtml } from "./escape-html";
import { getHandlerForAttribute, type Attributes } from "./attributes";
import { global_directive_data_array, sharedSSRSerialize } from "./shared-globals";
import { type SSRElement, isSSRElement, SSRElementBuilder } from "./ssr-element";
import { patchElement } from "./patchElement";
import { type TaskCtx, captureTasks } from "./task";

register(untrack, "__lentjs_untrack");
register(h, "__lentjs_h");

export type JSXElementString = number | string;
export type JSXElementSingular = SSRElement | ChildNode | JSXElementString | null | undefined;
export type JSXElementArray = JSXElement[];
export type JSXElementDynamic = (previous?: JSXElement) => JSXElement;
export type JSXElement = JSXElementSingular | JSXElementArray | JSXElementDynamic;
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type ComponentFn<P> = (props: P) => JSXElement;

export type EventHandler<E> = (event: E) => unknown;

export function isJSXElementString(t: unknown): t is JSXElementString {
  return typeof t === "string" || typeof t === "number";
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
    const [tasks, t] = captureTasks(() => stringifyJSXElement(h(el)));

    const ser_stores: Directives["stores"] = [];
    for (const [id, { obj }] of stores.entries()) {
      ser_stores.push([id, obj]);
    }
    const stores_data = createSSRDirective("stores", ser_stores);

    const ser_signals: Directives["signals"] = [];
    for (const [id, { currentValue }] of signals.entries()) {
      ser_signals.push([id, currentValue]);
    }
    const signals_data = createSSRDirective("signals", ser_signals);

    const ser_tasks: Directives["tasks"] = [];
    for (const task of tasks) {
      ser_tasks.push([task.storeReads, task.cb]);
    }
    const tasks_data = createSSRDirective("tasks", ser_tasks);

    const directives_data = createSSRDirective("directives-data", global_directive_data_array, true);

    return `${directives_data}${stores_data}${signals_data}${tasks_data}${t}`;
  }
  catch(e) {
    throw e;
  }
  finally {
    global_h_config = "dom";
  }
}

function createHTMLElement(element: string, props: object): HTMLElement {
  const el = document.createElement(element);
  for (const [propName, propVal] of Object.entries(props)) {
    if (propName === "children") {
      patchElement(el, null, null, propVal);
      continue;
    }

    const attrHandler = getHandlerForAttribute(propName);
    if (attrHandler === null) continue;
    if (attrHandler.managedDynamic && isFunction(propVal)) {
      const [val, storeReads] = listenForStoreReads(propVal);

      attrHandler.setOnHTMLElement(el, propName, val);

      const hh = microtaskDebounce(() => {
        const [newVal, newStoreReads] = listenForStoreReads(propVal);
        attrHandler.setOnHTMLElement(el, propName, newVal);
        subscribeToStoreReads(hh, newStoreReads, { once: true });
      });

      subscribeToStoreReads(hh, storeReads, { once: true });
    }
    else {
      attrHandler.setOnHTMLElement(el, propName, propVal);
    }
  }
  return el;
}
function createSSRElement(element: string, props: object): SSRElement {
  const builder = new SSRElementBuilder(element);

  const attributesResumeData: ResumeAttributesData = [];
  const dynamicAttributesData: DynamicAttributesData = [];

  for (const [propName, propVal] of Object.entries(props)) {
    if (propName === "children") {
      builder.appendInnerHTML(stringifyJSXElement(propVal, false));
      continue;
    }

    const attrHandler = getHandlerForAttribute(propName);
    if (attrHandler === null) continue;
    if (attrHandler.managedDynamic && isFunction(propVal)) {
      const [val, storeReads] = listenForStoreReads(propVal);
      dynamicAttributesData.push([storeReads, propName, propVal]);
      if (attrHandler.forceResume)
        attributesResumeData.push([propName, val]);
      attrHandler.setOnSSRElement(builder, propName, val);
    }
    else {
      if (attrHandler.forceResume)
        attributesResumeData.push([propName, propVal]);
      attrHandler.setOnSSRElement(builder, propName, propVal);
    }
  }

  if (attributesResumeData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:res-attrs`, sharedSSRSerialize(attributesResumeData).toString());
  }
  if (dynamicAttributesData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:dyn-attrs`, sharedSSRSerialize(dynamicAttributesData).toString());
  }
  
  return builder.build();
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
