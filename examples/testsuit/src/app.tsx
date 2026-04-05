import { type ComponentFn, register } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

const Complex: ComponentFn<{}> = register(() => {
  return [
    () => ["a", "b"],
    () => ["c", null, "d"],
    [() => "e", "f"],
    () => () => "g",
    () => "<span>This is html</span>",
  ];
}, "____RANDOM_ID");

const App: ComponentFn<{}> = () => {
  return <>
    <Counter />
    <hr />
    <Todo />
    <hr />
    <Complex />
    <hr />
    <List />
  </>;
};
export default App;
