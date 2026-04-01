import { h, type ComponentFn, register } from "lent";
import Counter from "./counter";
import Todo from "./todo";

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
    h("hr"),
    h("div", {
      children: h(Todo),
    }),
    h("hr"),
    h(Complex),
  ];
};
export default App;
