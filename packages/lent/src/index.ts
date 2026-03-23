import type { JSX } from "./jsx";

export abstract class Component<S = {}, P = {}> {
  protected abstract state: S;

  constructor(public readonly props: Readonly<P>) {}
  abstract render(): JSX.Element;
}

export function render(element: HTMLElement, jsx: JSX.Element) {
  console.log(jsx);
}

export function h(element: string | HTMLElement) {
  console.log(element);
}
