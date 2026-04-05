export type { JSX } from "./src/jsx";
export { Fragment } from "./src";
import { h, type JSXElement } from "./src";

export function jsx(element: any, props?: any, key?: any): JSXElement {
  if (key) {
    props = {...props, key};
  }
  return h(element, props);
}
export const jsxs = jsx;
