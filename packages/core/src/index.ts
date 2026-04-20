export * from "@lentjs/core-reactivity";
export { register } from "@lentjs/core-serialize";
export { createUid, assert } from "@lentjs/utils";
export { For } from "./for";
export { RefFor } from "./ref-for";
export { Show } from "./show";
export { startRuntime } from "./runtime";
export { Fragment } from "./fragment";
export type { Attributes, AttributeValue } from "./attributes";
export { type SSRElement, isSSRElement } from "./ssr-element";
export { resumed } from "./global-signals";
export { ChildrenArray } from "./children-array";
export { defineAsProps } from "./props-ser";
export { factory } from "./factory";
export { renderToString } from "./render-to-string";
export { renderToDom } from "./render-to-dom";
export type { JSX } from "./jsx";

import { register } from "@lentjs/core-serialize";
import { assert, isFunction, isObject } from "@lentjs/utils";
import { createTask, untrack, Scope, getScope } from "@lentjs/core-reactivity";
import type { SSRElement } from "./ssr-element";
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

export function isJSXElementString(t: unknown): t is JSXElementString {
  return typeof t === "string" || typeof t === "number";
}

export function isJSXElementDynamic(t: JSXElement): t is JSXElementDynamic {
  return isFunction(t);
}

export function isJSXElementWithScope(t: JSXElement): t is JSXElementWithScope {
  return isObject(t) && ("withScope" in t && "fun" in t);
}

const resumeTaskFn = register((cb: () => void) => {
  if (!resumed()) return;
  untrack(cb);
}, "__lentjs_onResumeTaskFn");
export function onResume(cb: () => void): void {
  createTask(resumeTaskFn.bind(null, cb));
}

const unmountResumeFn = register((cb: () => void) => {
  getScope().onCleanup(cb);
}, "__lentjs_unmountResumeFn");
export function onUnmount(cb: () => void): void {
  onResume(unmountResumeFn.bind(null, cb));
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

export function register$<T extends object>(val: T, id?: string): T {
  assert(typeof id === "string");
  return register(val, id);
}
