import { h, Component, type JSXElement, createTask } from "lent";

type CounterState = {
  count: number,
};
type CounterProps = {
  min: () => number,
  max: () => number,
};
class Counter extends Component<CounterState, CounterProps> {
  public static is_component_class: true = true;

  protected getInitialState(): CounterState {
    return {
      count: this.props.min(),
    };
  }

  protected init(): void {
    createTask(({ track }) => {
      const val = this.state.count;
      this.state.count = track(() => this.clamp(val));
    });
  }

  clamp(val: number) {
    const max = this.props.max();
    const min = this.props.min();

    if (val > max)
      return max;
    if (val < min)
      return min;
    return val;
  }

  render(): JSXElement {
    return h("div", {
      children: [
        h("div", {
          children: ["Count: ", () => this.state.count],
        }),
        h("button", {
          children: ["Increment to ", () => this.state.count + 1],
          "attr:disabled": () => this.state.count >= this.props.max() ? "true" : undefined,
          "on:click": () => {
            console.log(`Increment ${this.state.count} -> ${this.state.count+1}`);
            this.state.count = this.clamp(this.state.count+1);
          },
        }),
        h("button", {
          children: ["Decrement to ", () => this.clamp(this.state.count-1)],
          "attr:disabled": () => this.state.count <= this.props.min() ? "true" : undefined,
          "on:click": () => {
            console.log(`Decrement ${this.state.count} -> ${this.state.count-1}`);
            this.state.count = this.clamp(this.state.count-1);
          },
        }),
      ],
    });
  }
}

type AppState = {
  min: number,
  max: number,
};
export default class App extends Component<AppState> {
  protected getInitialState(): AppState {
    return {
      min: 0,
      max: 10,
    };
  }
  
  render(): JSXElement {
    return h("div", {
      class: ["a", "b b"],
      children: [
        h("div", {
          children: [
            "Min: ",
            h("input", {
              "attr:type": "number",
              "attr:value": () => `${this.state.min}`,
              "attr:max": () => `${this.state.max}`,
              "on:change": e => {
                if (!(e instanceof Event)) return;
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                console.log(`Min Changed: ${el.valueAsNumber}`);
                this.state.min = el.valueAsNumber;
              }
            }),
          ],
        }),
        h("div", {
          children: [
            "Max: ",
            h("input", {
              "attr:type": "number",
              "attr:value": () => `${this.state.max}`,
              "attr:min": () => `${this.state.min}`,
              "on:change": e => {
                if (!(e instanceof Event)) return;
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                console.log(`Changed: ${el.valueAsNumber}`);
                this.state.max = el.valueAsNumber;
              }
            }),
          ],
        }),
        h(Counter, {
          min: () => this.state.min,
          max: () => this.state.max,
        }),
      ],
    });
  }
}
