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
  ];
}, "____RANDOM_ID");

const App: ComponentFn<{}> = () => {
  return <>
    <div>
      <Counter />
    </div>
    <hr />
    <div>
      <Todo />
    </div>
    <hr />
    <Complex />
    <hr />
    <List />
  </>;
};
export default App;
