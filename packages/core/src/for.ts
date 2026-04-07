import { createControlledOwner, createSignal, enterOwner, untrack, type JSXElement } from ".";
import type { OwnerCleanup, SignalSetter } from "@lentjs/core-reactivity";
import { closure, register } from "@lentjs/core-serialize";

type ElementState<T> = {
  setEl: SignalSetter<T>,
  cleanup: OwnerCleanup,
};
type ForState<T> = {
  elements: ElementState<T>[],
};
export type ForProps<T> = {
  each: () => T[],
  children: (idx: number, element: () => T) => JSXElement,
};
const forMapper = register(<T>(props: ForProps<T>, state: ForState<T>, previous: JSXElement): JSXElement => {
  const newState: ElementState<T>[] = [];
  const oldState: ElementState<T>[] = state.elements;
  const oldElements = Array.isArray(previous) ? previous : [previous];
  const newElements: JSXElement[] = [];

  const each = props.each();
  for (let idx = 0; idx < each.length; idx++) {
    const val: T = each[idx]!;
    const oldel = oldState[idx];
    if (oldel) {
      oldel.setEl(val);
      newState.push(oldel);
      newElements.push(oldElements[idx]);
    }
    else {
      const [getEl, setEl] = createSignal(val);
      const [owner, ownerCleanup] = createControlledOwner();
      newState.push({
        setEl,
        cleanup: ownerCleanup,
      });
      newElements.push({
        withOwner: owner,
        fun: props.children.bind(null, idx, getEl),
      });
    }
  }

  for (let i = each.length; i < oldState.length; i++)
    oldState[i]!.cleanup();

  state.elements = newState;

  return newElements;
}, "__lentjs_forMapper");
export const For = register(<T>(props: ForProps<T>): JSXElement => {
  return closure(forMapper<T>, props, { elements: [] });
}, "__lentjs_for");
