import { Component } from "./component";
import { createSignal, untrack, type JSXElement } from ".";
import type { SignalSetter } from "./store";
import { bind } from "./serialize";

type ElementState = {
  index: number,
  setIndex: SignalSetter<number>,
};
type RefForState = {
  elements: Map<unknown, ElementState>,
};
export type RefForProps<T> = {
  each: () => T[],
  key: (value: T) => unknown,
  children: (element: T, idx: () => number) => JSXElement,
};
export class RefFor<T> extends Component<RefForState, RefForProps<T>> {
  static { this.register("__lentjs") }

  protected override init(): void {
    console.log(this.state);
  }

  protected override getInitialState(): RefForState {
    return {
      elements: new Map,
    };
  }

  private compute(previous: JSXElement): JSXElement {
    const previousState = untrack(() => this.state.elements);
    const newState = new Map<unknown, ElementState>;

    const previousElements = Array.isArray(previous) ? previous : [previous];
    const newElements: JSXElement[] = [];

    const each = this.props.each();
    each.forEach((val, idx) => {
      const key = this.props.key(val);
      const previousElementState = previousState.get(key);
      if (previousElementState) {
        newElements.push(previousElements[previousElementState.index]);
        previousElementState.setIndex(idx);
        newState.set(key, { index: idx, setIndex: previousElementState.setIndex });
      }
      else {
        const [getIndex, setIndex] = createSignal(idx);
        newState.set(key, { index: idx, setIndex });
        newElements.push(this.props.children(val, getIndex));
      }
    });

    this.state.elements = newState;

    return newElements;
  }

  override render(): JSXElement {
    return bind(this.compute, this);
  }
}

