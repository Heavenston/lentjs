import type { Attributes, JSXElement } from ".";

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  type Element = JSXElement;

  type ElementChildrenAttribute = {
    children: object;
  }

  type IntrinsicElements = {
    [key in string]: Attributes
  }
}
