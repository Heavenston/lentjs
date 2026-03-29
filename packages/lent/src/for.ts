import { Component } from "./component";
import { createSignal, untrack, type JSXElement, type JSXElementArray, type JSXElementSingular } from ".";
import type { SignalSetter } from "./store";

type ElementState<T> = {
  setEl: SignalSetter<T>,
};
type ForState<T> = {
  elements: ElementState<T>[],
};
export type ForProps<T> = {
  each: () => T[],
  children: (idx: number, element: () => T) => JSXElementSingular,
};
export class For<T> extends Component<ForState<T>, ForProps<T>> {
  static { this.register("__lentjs") }

  protected override init(): void {
    console.debug("For state:", this.state.elements);
  }

  protected override getInitialState(): ForState<T> {
    return {
      elements: [],
    };
  }

  private compute(previous: JSXElementArray): JSXElementArray {
    const old_jsx_elements = Array.isArray(previous) ? previous : [previous];
    console.log(old_jsx_elements);

    const new_elements: ElementState<T>[] = [];
    const old_elements: ElementState<T>[] = untrack(() => this.state.elements);
    const jsx_elements: JSXElementSingular[] = [];

    const each = this.props.each();
    for (let i = 0; i < each.length; i++) {
      const val: T = each[i]!;
      if (i < old_elements.length) {
        const el = old_elements[i]!;
        el.setEl(val);
        new_elements.push(el);
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
    return previous => this.compute(previous);
  }
}
