import type { ComponentFn, JSXElement } from ".";
import { closure, register } from "./serialize";

type Props = {
  when: () => boolean,
  children?: JSXElement,
  fallback?: JSXElement,
};

const conditional = register((props: Props) => {
  if (props.when())
    return props.children;
  else
    return props.fallback;
}, "__lentjs_showConditional");
export const Show: ComponentFn<Props> = register(props => {
  return closure(conditional, props);
}, "__lentjs_show");
