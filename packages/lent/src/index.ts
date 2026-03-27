export type JSXElement = Node | string | null | undefined | JSXElement[];
export type PropertyValue = string | number | (() => PropertyValue);
export type ClassList = string | Partial<Record<string, boolean>> | ClassList[];

interface Attributes {
  children?: JSXElement,
  class?: ClassList,
}

export abstract class Component<S = {}, P = {}> {
  protected readonly abstract initialState: S;
  #state: S | undefined;

  public get state(): S {
    if (this.#state === undefined) {
      this.#state = structuredClone(this.initialState);
    }
    return this.#state;
  }

  constructor(public readonly props: Readonly<P>) {}
  abstract render(): JSXElement;
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
export function h<P>(element: Component<any, P>, props: P): JSXElement;
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
      else {
        el.setAttribute(k, v as any);
      }
    }
    return el;
  }
}
