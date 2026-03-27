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
      track(() => this.clamp());
    });
  }

  clamp() {
    console.log("CLAMP");
    const max = this.props.max();
    const min = this.props.min();
    if (this.state.count > max)
      this.state.count = max;
    if (this.state.count < min)
      this.state.count = min;
  }

  render(): JSXElement {
    return h("div", {
      children: [
        h("div", {
          children: ["Count: ", () => this.state.count],
        }),
        h("button", {
          children: ["Increment to ", () => this.state.count + 1],
          "on:click": () => {
            console.log(`Increment ${this.state.count} -> ${this.state.count+1}`);
            this.state.count += 1;
            this.clamp();
          },
        }),
        h("button", {
          children: ["Decrement to ", () => this.state.count - 1],
          "on:click": () => {
            console.log(`Decrement ${this.state.count} -> ${this.state.count-1}`);
            this.state.count -= 1;
            this.clamp();
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
              "spread:type": "number",
              "spread:value": () => `${this.state.min}`,
              "spread:max": () => `${this.state.max}`,
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
              "spread:type": "number",
              "spread:value": () => `${this.state.max}`,
              "spread:min": () => `${this.state.min}`,
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
