import { h, Component, type JSXElement } from "lent";
import Counter from "./counter";
import Todo from "./todo";

class Complex extends Component {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): {} {
    return {};
  }

  render(): JSXElement {
    return [
      () => ["a", "b"],
      () => ["c", null, "d"],
      [() => "e", "f"],
      () => () => "g",
    ];
  }
}

type AppState = {
  min: number,
  max: number,
};
export default class App extends Component<AppState> {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): AppState {
    return {
      min: 0,
      max: 10,
    };
  }
  
  render(): JSXElement {
    return [
      h("div", {
        children: h(Counter),
      }),
      // h("hr"),
      // h("div", {
      //   children: h(Todo),
      // }),
      // h("hr"),
      // h(Complex),
    ];
  }
}
