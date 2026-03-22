import type { Lent } from "./jsx-runtime";

export abstract class Component<S = {}, P = {}> implements Lent.IComponent<P> {
  protected abstract state: S;

  constructor(public readonly props: Readonly<P>) {}
  abstract render(): Lent.JSXOutput;
}

export function render(element: HTMLElement, jsx: Lent.JSXOutput) {
  console.log(jsx);
}

export function h(element: string | HTMLElement) {
  console.log(element);
}
