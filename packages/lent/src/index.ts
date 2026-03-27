export type JSXElement = Node | number | string | null | undefined | JSXElement[] | (() => JSXElement);
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type EventHandler<E> = (event: E) => unknown;

export type Attributes = {
  children?: JSXElement,
  class?: ClassList,
} & {
  [key in `on:${string}`]: EventHandler<Event>
};

function isFunction(t: unknown): t is (...args: any) => any {
  return typeof t === "function";
}

const is_store = Symbol("is_store");
export type Store<S> = S & { [is_store]: true };

let current_store_read_callback: (() => void) | null = null;
function createStore<S extends object>(initialValue: S): Store<S> {
  let prop_callbacks = new Map<string | symbol, (() => void)[]>;
  return new Proxy<any>({ ...initialValue }, {
    set: (obj, prop, value) => {
      const changed = obj[prop] !== value;
      // @ts-ignore
      obj[prop] = value;
      if (changed) {
        const arr = prop_callbacks.get(prop);
        if (arr)
          for (const cb of arr)
            cb();
      }
      return true;
    },
    // FIX: There is no way to unsubscribe
    get(obj, prop) {
      if (current_store_read_callback !== null) {
        const prop_array = prop_callbacks.get(prop) ?? prop_callbacks.set(prop, []).get(prop)!;
        prop_array.push(current_store_read_callback);
      }
      return obj[prop];
    },
  });
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

  constructor(public readonly props: Readonly<P>) {}

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

function normalizeChildren(child: JSXElement): (Node | (() => Node[]))[] {
  if (child == null) return [];
  if (Array.isArray(child)) {
    return child.flatMap(normalizeChildren);
  }
  if (typeof child === "string") {
    return [document.createTextNode(child)];
  }
  if (typeof child === "number") {
    return normalizeChildren(`${child}`);
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

function addChild(parent: Node, child: JSXElement) {
  const normalizedChildren = normalizeChildren(child);
  for (const child of normalizedChildren) {
    if (isFunction(child)) {
      const start_comment = new Comment("lentjs start");
      const end_comment = new Comment("lentjs end");

      const cb = () => {
        const new_nodes = child();
        const parentNodes = [...parent.childNodes];

        const s = parentNodes.indexOf(start_comment);
        const e = parentNodes.indexOf(end_comment);
        let current: Node = start_comment;
        for (let i = 0; i < new_nodes.length; i++) {
          const oldnode = s+i+1 < e ? parentNodes[s + i + 1] : null;
          const newnode = new_nodes[i]!;
          if (oldnode instanceof Text && newnode instanceof Text) {
            oldnode.textContent = newnode.textContent;
          } else
          if (oldnode) {
            parent.replaceChild(newnode, oldnode);
          }
          else {
            parent.insertBefore(newnode, current.nextSibling);
          }
          current = newnode;
        }
      };

      if (current_store_read_callback !== null)
        throw new Error("Recursive dynamic childs not yet supported");
      current_store_read_callback = cb;
      let nodes = child();
      current_store_read_callback = null;

      parent.appendChild(start_comment);
      for (const subchild of nodes)
        parent.appendChild(subchild);
      parent.appendChild(end_comment);
    }
    else {
      parent.appendChild(child);
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

export function h(element: string, props: Attributes): JSXElement;
export function h<P>(element: ComponentFactory<P, any>, props: P): JSXElement;
export function h(element: any, props: any): JSXElement {
  if (typeof element === "string") {
    const el = document.createElement(element);
    for (const [k, v] of Object.entries(props)) {
      if (k === "children") {
        addChild(el, v as JSXElement);
        continue;
      }
      else if (k === "class") {
        if (typeof v === "string")
          el.className = v;
        else
          el.classList.add(...renderClasslist(v as ClassList));
      }
      else if (k.startsWith("on:")) {
        // @ts-ignore
        el.addEventListener(k.replace(/^on:/, ""), v);
      }
      else {
        el.setAttribute(k, v as any);
      }
    }
    return el;
  }
  // is a component factory
  else {
    return constructComponent(element, props).render();
  }

  throw new Error("no implemented");
}
