import { h, Component, type JSXElement } from "lent";

type AppState = {
  
};
export default class App extends Component<AppState> {
  protected readonly initialState: AppState = {
  };

  render(): JSXElement {
    return h("div", {
      class: ["a", "b b"],
      children: [
        h("span", {
          children: "Test",
        })
      ],
    });
  }
}
