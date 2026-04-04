import { h, type ComponentFn, register } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

const Complex: ComponentFn<{}> = register((props) => {
  return [
    () => ["a", "b"],
    () => ["c", null, "d"],
    [() => "e", "f"],
    () => () => "g",
  ];
}, "____RANDOM_ID");

const App: ComponentFn<{}> = () => {
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
    // h("hr"),
    // h(List),
  ];
};
export default App;
