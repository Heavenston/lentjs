import { h, Component, type JSXElement } from "lent";
import Counter from "./counter";

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
        h(Counter, {}),
      ],
    });
  }
}
