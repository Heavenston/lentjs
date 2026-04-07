import type { ComponentFn, JSXElement, OwnerCleanup } from ".";
import { closure, register } from "@lentjs/core-serialize";
import { createControlledOwner, enterOwner, untrack } from "@lentjs/core-reactivity";
import { constant } from "@lentjs/utils";

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
  const fn = (props.when() ? props.children : props.fallback) ?? constant(null);

  return enterOwner(owner, untrack, fn);
}, "__lentjs_showConditional");
export const Show: ComponentFn<Props> = register(props => {
  return closure(conditional, props, {
    cleanup: null,
  });
}, "__lentjs_show");
