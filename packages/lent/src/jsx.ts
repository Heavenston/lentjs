import type { Attributes, JSXElement } from ".";

export declare namespace JSX {
  type Element = JSXElement;

  interface ElementChildrenAttribute {
    children: {};
  }

  type IntrinsicElements = {
    [key in string]: Attributes
  }
}
