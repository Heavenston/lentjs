import type { ComponentFn, JSXElement, OwnerCleanup } from ".";
import { closure, register } from "@lentjs/core-serialize";
import { createControlledOwner, enterOwner } from "@lentjs/core-reactivity";
import { constant, noop } from "@lentjs/utils";

type Props = {
  when: () => boolean,
  children?: () => JSXElement,
  fallback?: () => JSXElement,
};

type State = {
  cleanup: OwnerCleanup | null,
};

const conditional = register((props: Props, state: State): JSXElement => {
  state.cleanup?.();
  const [owner, ownerCleanup] = createControlledOwner();
  state.cleanup = ownerCleanup;
  const fn = props.when() ? props.children : props.fallback;

  return (enterOwner<[], JSXElement>).bind(null, owner, fn ?? constant(null));
}, "__lentjs_showConditional");
export const Show: ComponentFn<Props> = register(props => {
  return closure(conditional, props, {
    cleanup: null,
  });
}, "__lentjs_show");
