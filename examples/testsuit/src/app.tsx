import { type ComponentFn, register, createSignal, Show, createContextKey, getScope } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

export const AppContextId = createContextKey<string>("____RANDOM_ID");

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

  getScope().setContext(AppContextId, "Within ContitionalCounter");

  const [show, setShow] = createSignal(true);
  
  return <>
    <button on:click={() => setShow.update(u => !u)}>
      {show() ? "Hide" : "Show"}
    </button>
    <Show when={show()}>
      <Counter />
    </Show>
  </>;
}, "____RANDOM_ID");

const App: ComponentFn<{}> = register(() => {
  "use component";

  getScope().setContext(AppContextId, "Within App");

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
}, "____RANDOM_ID");
export default App;
