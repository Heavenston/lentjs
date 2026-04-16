import type { ComponentFn, JSXElement, ScopeCleanup } from ".";
import { closure, register } from "@lentjs/core-serialize";
import { Scope, untrack } from "@lentjs/core-reactivity";
import { constant } from "@lentjs/utils";

type Props = {
  when: () => boolean,
  children?: () => JSXElement,
  fallback?: () => JSXElement,
};

type State = {
  cleanup: ScopeCleanup | null,
};

const conditional = register((props: Props, state: State): JSXElement => {
  state.cleanup?.();
  const [scope, scopeCleanup] = Scope.createControlled();
  state.cleanup = scopeCleanup;
  const fn = (props.when() ? props.children : props.fallback) ?? constant(null);

  return scope.enter(untrack, fn);
}, "__lentjs_showConditional");
export const Show: ComponentFn<Props> = register(props => {
  return closure(conditional, props, {
    cleanup: null,
  });
}, "__lentjs_show");
