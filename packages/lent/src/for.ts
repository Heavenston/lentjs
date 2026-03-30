import { Component } from "./component";
import { createSignal, untrack, type JSXElement } from ".";
import type { SignalSetter } from "./store";
import { bind } from "./serialize";

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
export class For<T> extends Component<ForState<T>, ForProps<T>> {
  static { this.register("__lentjs") }

  protected override getInitialState(): ForState<T> {
    return {
      elements: [],
    };
  }

  private compute(previous: JSXElement): JSXElement {
    const old_jsx_elements = Array.isArray(previous) ? previous : [previous];

    const new_elements: ElementState<T>[] = [];
    const old_elements: ElementState<T>[] = untrack(() => this.state.elements);
    const jsx_elements: JSXElement[] = [];

    const each = this.props.each();
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
        const child = untrack(() => this.props.children(i, el));
        jsx_elements.push(child);
      }
    }

    this.state.elements = new_elements;

    return jsx_elements;
  }

  override render(): JSXElement {
    return bind(this.compute, this);
  }
}
