import type { ComponentFn, JSXElement, ScopeCleanup } from ".";
import { closure, register } from "@lentjs/core-serialize";
import { Scope } from "@lentjs/core-reactivity";

type Props = {
  when: boolean,
  children?: JSXElement,
  fallback?: JSXElement,
};

type State = {
  previous?: boolean,
  cleanup: ScopeCleanup | null,
};

const conditional = register((props: Props, state: State, previousElement?: JSXElement): JSXElement => {
  const when = props.when;
  if (when === state.previous) return previousElement;
  state.previous = when;

  state.cleanup?.();
  const [scope, scopeCleanup] = Scope.createControlled();
  state.cleanup = scopeCleanup;

  return scope.enter(() => {
    if (when) {
      return props.children;
    }
    else {
      return props.fallback;
    }
  });
}, "__lentjs_showConditional");
export const Show: ComponentFn<Props> = register(props => {
  return closure(conditional, props, {
    cleanup: null,
  });
}, "__lentjs_show");
