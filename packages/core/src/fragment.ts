import { getProperty } from "@lentjs/utils";
import type { ComponentFn, JSXElement } from ".";
import { register } from "@lentjs/core-serialize";

export const Fragment: ComponentFn<{ children?: JSXElement }> = register(props => {
  // equivalent to:
  // return () => props.children;
  return (getProperty<{ children?: JSXElement }, "children">).bind(null, props, "children");
}, "__lentjs_fragment");
