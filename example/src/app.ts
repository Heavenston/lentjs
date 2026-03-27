import { h, Component, type JSXElement, createTask } from "lent";

type CounterState = {
  count: number,
};
type CounterProps = {
  start: () => number,
};
class Counter extends Component<CounterState, CounterProps> {
  public static is_component_class: true = true;

  protected getInitialState(): CounterState {
    return {
      count: this.props.start(),
    };
  }

  protected init(): void {
    createTask(({ track }) => {
      console.log("Task!");
      this.state.count = track(() => this.props.start());
    });
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
          },
        }),
        h("button", {
          children: ["Decrement to ", () => this.state.count - 1],
          "on:click": () => {
            console.log(`Decrement ${this.state.count} -> ${this.state.count-1}`);
            this.state.count -= 1;
          },
        }),
      ],
    });
  }
}

type AppState = {
  start: number,
};
export default class App extends Component<AppState> {
  protected getInitialState(): AppState {
    return {
      start: 5,
    };
  }
  
  render(): JSXElement {
    return h("div", {
      class: ["a", "b b"],
      children: [
        h("div", {
          children: [
            h("input", {
              "spread:type": "number",
              "spread:value": `${this.state.start}`,
              "spread:min": "0",
              "on:change": e => {
                if (!(e instanceof Event)) return;
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                console.log(`Changed: ${el.valueAsNumber}`);
                this.state.start = isNaN(el.valueAsNumber) ? 0 : el.valueAsNumber;
              }
            }),
          ],
        }),
        h(Counter, {
          start: () => this.state.start,
        }),
      ],
    });
  }
}
