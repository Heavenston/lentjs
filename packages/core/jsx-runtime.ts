export type { JSX } from "./src/jsx";
export { Fragment } from "./src";
import { factory, type JSXElement } from "./src";

export function jsx(element: any, props?: any, key?: any): JSXElement {
  if (key) {
    props = {...props, key};
  }
  return factory(element, props);
}
export const jsxs = jsx;
