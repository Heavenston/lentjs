import { type ComponentFn, register, createSignal, Show } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

const Complex: ComponentFn<{}> = register(() => {
  "use component";

  return [
    () => ["a", "b"],
    () => ["c", null, "d"],
    [() => "e", "f"],
    () => () => "g",
    () => "<span>This is html</span>",
  ];
}, "____RANDOM_ID");

const ConditionalCounter: ComponentFn<{}> = register(() => {
  "use component";

  const [show, setShow] = createSignal(false);
  
  return <>
    <button on:click={() => setShow.update(u => !u)}>
      {() => show() ? "Hide" : "Show"}
    </button>
    <Show when={show}>
      <Counter />
    </Show>
  </>;
}, "____RANDOM_ID");

const App: ComponentFn<{}> = () => {
  "use component";

  return <>
    <Counter />
    <hr />
    <ConditionalCounter />
    <hr />
    <Todo />
    <hr />
    <Complex />
    <hr />
    <List />
  </>;
};
export default App;
