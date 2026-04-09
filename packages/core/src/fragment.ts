import { getProperty } from "@lentjs/utils";
import type { JSXElement } from ".";
import { register } from "@lentjs/core-serialize";

export const Fragment = register((props: { children?: JSXElement }): JSXElement => {
  return (getProperty<{ children?: JSXElement }, "children">).bind(null, props, "children");
}, "__lentjs_fragment");
