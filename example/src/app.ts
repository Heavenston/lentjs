import { h, Component, type JSXElement } from "lent";

type CounterState = {
  count: number,
};
class Counter extends Component<CounterState> {
  public static is_component_class: true = true;

  protected getInitialState(): CounterState {
    return {
      count: 0,
    };
  }

  render(): JSXElement {
    return h("div", {
      children: [
        h("div", {
          children: ["Count: ", () => this.state.count],
        }),
        h("button", {
          children: ["Increment ", () => this.state.count],
          "on:click": () => {
            console.log(`Clicked ${this.state.count} -> ${this.state.count+1}`);
            this.state.count += 1;
          },
        }),
      ],
    });
  }
}

type AppState = {
  
};
export default class App extends Component<AppState> {
  protected getInitialState(): AppState {
    return {};
  }
  
  render(): JSXElement {
    return h("div", {
      class: ["a", "b b"],
      children: [
        h("span", {
          children: "Test",
        }),
        h(Counter, {}),
      ],
    });
  }
}
