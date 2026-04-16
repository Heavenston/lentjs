export * from "@lentjs/core-reactivity";
export { For } from "./for";
export { RefFor } from "./ref-for";
export { Show } from "./show";
export { startRuntime } from "./runtime";
export { register } from "@lentjs/core-serialize";
export { Fragment } from "./fragment";
export { type Attributes, type AttributeValue } from "./attributes";
export { type SSRElement, isSSRElement } from "./ssr-element";
export { resumed } from "./global-signals";
export * from "./children-array";
export { defineAsProps } from "./props-ser";

import { register, serialize } from "@lentjs/core-serialize";
import { getProperty, isFunction, isObject } from "./utils";
import { createTask, startReaction, untrack, Scope, getScope, taskCaptureContextKey, type TaskCaptureData } from "@lentjs/core-reactivity";
import { DIRECTIVE_PREFIX, type ResumeAttributesData, type DirectiveName, type Directives, type DynamicAttributesData, type MarkerDirectiveName, ATTRIBUTE_PREFIX } from "./runtime";
import { escapeHtml } from "./escape-html";
import { getHandlerForAttribute, type Attributes } from "./attributes";
import { global_directive_data_array, sharedSSRSerialize } from "./shared-globals";
import { type SSRElement, isSSRElement, SSRElementBuilder } from "./ssr-element";
import { cleanupStateNodes, patchElement } from "./patchElement";
import { resumed } from "./global-signals";

export type JSXElementString = number | string;
export type JSXElementSingular = SSRElement | ChildNode | JSXElementString | null | undefined;
export type JSXElementArray = JSXElement[];
export type JSXElementDynamic = (previous?: JSXElement) => JSXElement;
export type JSXElementWithScope = { fun: () => JSXElement, withScope: Scope };
export type JSXElement = JSXElementSingular | JSXElementArray | JSXElementWithScope | JSXElementDynamic;
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type ComponentFn<P> = (props: P) => JSXElement;

export type EventHandler<E> = (event: E) => unknown;

const resumeTaskFn = register((cb: () => void) => {
  if (!resumed()) return;
  untrack(cb);
}, "__lentjs_onResumeTaskFn");
export function onResume(cb: () => void) {
  createTask(resumeTaskFn.bind(null, cb));
}

const unmountResumeFn = register((cb: () => void) => {
  getScope().onCleanup(cb);
}, "__lentjs_unmountResumeFn");
export function onUnmount(cb: () => void) {
  onResume(unmountResumeFn.bind(null, cb));
}

export function isJSXElementString(t: unknown): t is JSXElementString {
  return typeof t === "string" || typeof t === "number";
}

export function isJSXElementDynamic(t: JSXElement): t is JSXElementDynamic {
  return isFunction(t);
}

export function isJSXElementWithScope(t: JSXElement): t is JSXElementWithScope {
  return isObject(t) && ("withScope" in t && "fun" in t);
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
  else if (el === null) {
    return isInsideDynamic ? createSSRDirective("nul", null) : "";
  }
  else if (el === undefined) {
    return isInsideDynamic ? createSSRDirective("und", null) : "";
  }
  else if (isJSXElementDynamic(el)) {
    const [val, reactivityData] = startReaction(() => el());
    if (reactivityData.length <= 0 && !isInsideDynamic) {
      return stringifyJSXElement(val, false);
    }
    const prefix = createSSRDirective("dyn", {
      update: el,
      reactivityData: reactivityData,
    });
    const suffix = createSSRDirective("dyn/");
    return `${prefix}${stringifyJSXElement(val, true)}${suffix}`;
  }
  else if (isJSXElementWithScope(el)) {
    const prefix = createSSRDirective("sco", el.withScope);
    const suffix = createSSRDirective("sco/");
    return el.withScope.enter(() => {
      return `${prefix}${stringifyJSXElement(el.fun(), false)}${suffix}`;
    });
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
  else {
    el satisfies Node;
    throw new Error("Node impossible on the server");
  }
}

export function renderToDom(parent: Node, el: ComponentFn<{}>) {
  Scope.create().enter(() => {
    const val = patchElement(parent, null, null, h(el));
    // @ts-ignore This is useless and just used to prevent val from being gced
    globalThis[Symbol("gc-prevention")] = val;
  });
}

export function renderToString(el: ComponentFn<{}>): string {
  global_directive_data_array.length = 0;

  global_h_config = "ssr";
  try {
    const [scope, cleanup] = Scope.createControlled();
    const taskCaptureData: TaskCaptureData = { capturedTasks: [] };
    scope.setContext(taskCaptureContextKey, taskCaptureData);
    const rootScopeDirective = createSSRDirective("sco", scope);
    const t = scope.enter(() => stringifyJSXElement(h(el)));
    const tasksDirective = createSSRDirective("tasks", taskCaptureData);
    const directivesData = `<script lang="application/json" ${ATTRIBUTE_PREFIX}:data>${serialize(global_directive_data_array)}</script>`;
    // We need to cleanup after serialization otherwise we serialize the scopes in the cleaned state
    cleanup();
    return `${directivesData}${rootScopeDirective}${t}${tasksDirective}`;
  }
  catch(e) {
    throw e;
  }
  finally {
    global_h_config = "dom";
  }
}

function createHTMLElement(element: string, props: any): HTMLElement {
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
function createSSRElement(element: string, props: any): SSRElement {
  const builder = new SSRElementBuilder(element);

  const attributesResumeData: ResumeAttributesData = [];
  const dynamicAttributesData: DynamicAttributesData = [];

  for (const propName of Object.keys(props)) {
    // TODO: Children may be reactive too!(?)
    if (propName === "children") {
      builder.appendInnerHTML(stringifyJSXElement((getProperty<any, any>).bind(null, props, "children"), false));
      continue;
    }

    const attrHandler = getHandlerForAttribute(propName);
    if (attrHandler === null) continue;
    const [val, reactivityData] = startReaction(() => props[propName]);
    attrHandler.setOnSSRElement(builder, propName, val);
    if (reactivityData.length > 0)
      dynamicAttributesData.push([reactivityData, propName, (getProperty<any, any>).bind(null, props, propName)])
    if (attrHandler.forceResume)
      attributesResumeData.push([propName, val]);
    attrHandler.setOnSSRElement(builder, propName, val);
  }

  if (attributesResumeData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:res-attrs`, sharedSSRSerialize(attributesResumeData).toString());
  }
  if (dynamicAttributesData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:dyn-attrs`, sharedSSRSerialize(dynamicAttributesData).toString());
  }
  
  return builder.build();
}

export function h(element: string, props?: Attributes): JSXElement;
export function h(element: ComponentFn<{}>): JSXElement;
export function h<P>(element: ComponentFn<P>, props: P): JSXElement;
export function h<P>(element: string | ComponentFn<P>, props?: P): JSXElement {
  if (typeof element === "string") {
    if (global_h_config === "ssr") {
      return untrack(()=>createSSRElement(element, props ?? {}));
    }
    else if (global_h_config === "dom") {
      return untrack(()=>createHTMLElement(element, props ?? {}));
    }
    else {
      throw new Error("Invalid global_h_config value");
    }
  }
  else {
    return {
      withScope: Scope.create(),
      fun: element.bind(null, props!),
    };
  }
}
register(h, "__lentjs_h");
