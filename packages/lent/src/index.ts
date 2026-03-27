export { createStore, type Store } from "./store";
export { createTask } from "./task";

import { type Store, createStore } from "./store";
import { immediateTrack } from "./task";

export type JSXElement = Node | number | string | null | undefined | JSXElement[] | (() => JSXElement);
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type EventHandler<E> = (event: E) => unknown;

export type Attributes = {
  children?: JSXElement,
  class?: ClassList | (() => ClassList),
} & {
  [key in `on:${string}`]?: EventHandler<Event>
} & {
  [key in `attr:${string}`]?: string | undefined | (() => string | undefined)
};

function isFunction(t: unknown): t is (...args: any) => any {
  return typeof t === "function";
}

export abstract class Component<S extends object = {}, P = {}> {
  #state: Store<S> | undefined;
  #onStateUpdate: (() => unknown)[] = [];

  #createInitialState(): Store<S> {
    return createStore(this.getInitialState());
  }

  public onStateUpdate(cb: () => unknown): () => void {
    this.#onStateUpdate.push(cb);
    return () => {
      const idx = this.#onStateUpdate.findIndex(p => p === cb);
      if (idx >= 0)
        this.#onStateUpdate.splice(idx, 1);
    }
  }
  
  protected get state(): Store<S> {
    if (this.#state === undefined) {
      this.#state = this.#createInitialState();
    }
    return this.#state;
  }

  constructor(public readonly props: Readonly<P>) {
    this.init?.();
  }

  protected init?(): void;
  protected abstract getInitialState(): S;
  abstract render(): JSXElement;
}

export type ComponentFactory<P, C extends Component<any, P>> = (((props: P) => C) & { is_component_class?: undefined }) | { is_component_class: true, new(props: P): C }
function constructComponent<P, C extends Component<any, P>, F extends ComponentFactory<P, C>>(factory: F, props: P): C {
  if (factory.is_component_class)
    return new factory(props);
  else
    return factory(props);
}

type NormalizedNode = string | Node;
function normalizeChildren(child: JSXElement): (NormalizedNode | (() => NormalizedNode[]))[] {
  if (child == null) return [];
  if (Array.isArray(child)) {
    return child.flatMap(normalizeChildren);
  }
  if (typeof child === "string" || typeof child === "number") {
    return [child.toString()];
  }
  if (isFunction(child)) {
    type InfiniteFunction<A, B> = A | (() => InfiniteFunction<B, B>);
    function fullCall<A, B>(n: InfiniteFunction<A, B>): A | B {
      if (isFunction(n))
        return fullCall(n());
      return n;
    }
    return [() => normalizeChildren(child()).flatMap(fullCall)];
  }
  return [child];
}

const nodify = (n: NormalizedNode) => typeof n === "string" ? document.createTextNode(n) : n;
function addChild(parent: Node, child: JSXElement) {
  const normalizedChildren = normalizeChildren(child);
  for (const child of normalizedChildren) {
    if (isFunction(child)) {
      const start_comment = new Comment("lentjs start");
      const end_comment = new Comment("lentjs end");

      // FIXME: Call unsubscribe
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
      });
    }
    else {
      parent.appendChild(nodify(child));
    }
  }
}

function renderClasslist(list: ClassList): string[] {
  if (typeof list === "string") {
    const p = document.createElement("div");
    p.className = list;
    return [...p.classList];
  }
  if (Array.isArray(list))
    return list.flatMap(renderClasslist);
  return Object.entries(list)
    .filter(([k, v]) => typeof k === "string" && v)
    .map(([k, _]) => k);
}

export function render(container: HTMLElement, jsx: { new(props: {}): Component }) {
  const p = new jsx({});
  const output = p.render();
  addChild(container, output);
}

function createElement(element: string, props: Attributes): JSXElement {
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
          if (value !== undefined)
            el.setAttribute(tk, value);
          else
            el.removeAttribute(tk);
        });
      }
      else {
        if (tv !== undefined)
          el.setAttribute(tk, tv);
        else
          el.removeAttribute(tk);
      }
    }
    else {
      throw new Error(`Unsupported attribute ${k}`);
    }
  }
  return el;
}

export function h(element: string, props: Attributes): JSXElement;
export function h<P>(element: ComponentFactory<P, any>, props: P): JSXElement;
export function h(element: any, props: any): JSXElement {
  if (typeof element === "string") {
    return createElement(element, props);
  }
  // is a component factory
  else {
    return constructComponent(element, props).render();
  }
}
