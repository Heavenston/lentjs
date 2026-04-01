import { createSignal, untrack, type JSXElement } from ".";
import type { SignalSetter } from "./store";
import { closure, register } from "./serialize";

type ElementState = {
  index: number,
  setIndex: SignalSetter<number>,
};
type ForState = {
  currentState: Map<unknown, ElementState>,
};
export type RefForProps<T> = {
  each: () => T[],
  key: (value: T) => unknown,
  children: (element: T, idx: () => number) => JSXElement,
};
const forMapper = register(<T>(props: RefForProps<T>, state: ForState, previous: JSXElement) => {
  const previousState = state.currentState;
  const newState = new Map<unknown, ElementState>;

  const previousElements = Array.isArray(previous) ? previous : [previous];
  const newElements: JSXElement[] = [];

  const each = props.each();
  each.forEach((val, idx) => {
    const key = props.key(val);
    const previousElementState = previousState.get(key);
    if (previousElementState) {
      newElements.push(previousElements[previousElementState.index]);
      previousElementState.setIndex(idx);
      newState.set(key, { index: idx, setIndex: previousElementState.setIndex });
    }
    else {
      const [getIndex, setIndex] = createSignal(idx);
      newState.set(key, { index: idx, setIndex });
      newElements.push(untrack(() => props.children(val, getIndex)));
    }
  });

  state.currentState = newState;

  return newElements;
}, "__lentjs_refForMapper");
export const RefFor = register(<T>(props: RefForProps<T>): JSXElement => {
  return closure(forMapper, props, { currentState: new Map<unknown, ElementState> });
}, "__lentjs_refFor");
