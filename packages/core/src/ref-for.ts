import { createControlledOwner, createSignal, enterOwner, untrack, type JSXElement } from ".";
import type { OwnerCleanup, SignalAccessor, SignalSetter } from "@lentjs/core-reactivity";
import { closure, register } from "@lentjs/core-serialize";

type ElementState = {
  index: number,
  setIndex: SignalSetter<number>,
  cleanup: OwnerCleanup,
};
type ForState = {
  currentState: Map<unknown, ElementState>,
};
export type RefForProps<T> = {
  each: () => T[],
  key: (value: T) => unknown,
  children: (element: T, idx: SignalAccessor<number>) => JSXElement,
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
    previousState.delete(key);
    if (previousElementState) {
      newElements.push(previousElements[previousElementState.index]);
      previousElementState.setIndex(idx);
      newState.set(key, {
        index: idx,
        setIndex: previousElementState.setIndex,
        cleanup: previousElementState.cleanup,
      });
    }
    else {
      const [getIndex, setIndex] = createSignal(idx);
      const [owner, ownerCleanup] = createControlledOwner();
      newState.set(key, {
        index: idx,
        setIndex,
        cleanup: ownerCleanup,
      });
      newElements.push(enterOwner(owner, () => untrack(() => props.children(val, getIndex))));
    }
  });

  for (const removedElement of previousState.values()) {
    removedElement.cleanup();
  }

  state.currentState = newState;

  return newElements;
}, "__lentjs_refForMapper");
export const RefFor = register(<T>(props: RefForProps<T>): JSXElement => {
  return closure(forMapper, props, { currentState: new Map });
}, "__lentjs_refFor");
