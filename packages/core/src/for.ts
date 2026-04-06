import { createSignal, untrack, type JSXElement } from ".";
import type { SignalSetter } from "@lentjs/core-reactivity";
import { closure, register } from "@lentjs/core-serialize";

type ElementState<T> = {
  setEl: SignalSetter<T>,
};
type ForState<T> = {
  elements: ElementState<T>[],
};
export type ForProps<T> = {
  each: () => T[],
  children: (idx: number, element: () => T) => JSXElement,
};
const forMapper = register(<T>(props: ForProps<T>, state: ForState<T>, previous: JSXElement): JSXElement => {
  const old_jsx_elements = Array.isArray(previous) ? previous : [previous];

  const new_elements: ElementState<T>[] = [];
  const old_elements: ElementState<T>[] = state.elements;
  const jsx_elements: JSXElement[] = [];

  const each = props.each();
  for (let i = 0; i < each.length; i++) {
    const val: T = each[i]!;
    const oldel = old_elements[i];
    if (oldel) {
      oldel.setEl(val);
      new_elements.push(oldel);
      jsx_elements.push(old_jsx_elements[i]);
    }
    else {
      const [el, setEl] = createSignal(val);
      new_elements.push({
        setEl,
      });
      const child = untrack(() => props.children(i, el));
      jsx_elements.push(child);
    }
  }

  state.elements = new_elements;

  return jsx_elements;
}, "__lentjs_forMapper");
export const For = register(<T>(props: ForProps<T>): JSXElement => {
  return closure(forMapper<T>, props, { elements: [] });
}, "__lentjs_for");
