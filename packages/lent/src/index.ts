import type { JSX } from "./jsx";
export type JSXElement = JSX.Element;
export type { JSX };

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

export function render(element: HTMLElement, jsx: JSXElement) {
  console.log("render", { element, jsx });
}

export function h(element: string | HTMLElement) {
  console.log("h", { element });
}
