import type { JSXElement } from ".";
import { register } from "@lentjs/core-serialize";

export const Fragment = register((props: { children?: JSXElement }): JSXElement => {
  return props.children;
}, "__lentjs_fragment");
