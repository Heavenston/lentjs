import { Component } from "./component";
import { createStore, untrack, type JSXElement } from ".";

type ElementState<T> = {
  value: JSXElement,
  el: { value: T },
  dispose: () => void,
};
type ForState<T> = {
  elements: ElementState<T>[],
};
export type ForProps<T> = {
  each: () => T[],
  children: (idx: number, element: () => T) => JSXElement,
};
export class For<T> extends Component<ForState<T>, ForProps<T>> {
  protected override getInitialState(): ForState<T> {
    return {
      elements: [],
    };
  }

  #compute(): JSXElement[] {
    const new_elements: ElementState<T>[] = [];
    const old_elements: ElementState<T>[] = untrack(() => this.state.elements);
    const each = this.props.each();
    for (let i = 0; i < each.length; i++) {
      const val: T = each[i]!;
      if (i < old_elements.length) {
        const el = old_elements[i]!;
        el.el.value = val;
        new_elements.push(el);
      }
      else {
        const el = createStore({ value: val });
        new_elements.push({
          // TODO
          dispose: () => {},
          el,
          value: untrack(() => this.props.children(i, () => el.value)),
        });
      }
    }
    for (let i = each.length; i < old_elements.length; i++) {
      old_elements[i]!.dispose();
    }
    this.state.elements = new_elements;
    return new_elements.map(el => el.value);
  }

  override render(): JSXElement {
    return () => this.#compute();
  }
}
