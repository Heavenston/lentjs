export type JSXElement = Node | string | null | undefined | JSXElement[] | (() => JSXElement);
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

export type EventHandler<E> = (event: E) => unknown;

export type Attributes = {
  children?: JSXElement,
  class?: ClassList,
} & {
  [key in `on:${string}`]: EventHandler<Event>
};

export abstract class Component<S = {}, P = {}> {
  #state: S | undefined;

  protected get state(): S {
    if (this.#state === undefined) {
      this.#state = this.getInitialState();
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

function addChild(parent: Node, child: JSXElement) {
  if (!child) return;
  if (Array.isArray(child)) {
    for (const c of child)
      addChild(parent, c);
    return;
  }
  if (typeof child === "string") {
    return addChild(parent, document.createTextNode(child));
  }
  if (typeof child === "function") {
    return addChild(parent, child());
  }
  parent.appendChild(child);
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
  console.log("output", output);
  console.log(container);
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
