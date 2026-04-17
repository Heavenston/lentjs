import { type ComponentFn, createSignal, Show, createContextId, getScope, register$ } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

export const AppContextId = createContextId<string>("____RANDOM_ID");

const Complex: ComponentFn<{}> = register$(() => {
  return [
    () => ["a", "b"],
    () => ["c", null, "d"],
    [() => "e", "f"],
    () => () => "g",
    () => "<span>This is html</span>",
  ];
});

const ConditionalCounter: ComponentFn<{}> = register$(() => {
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
});

const App: ComponentFn<{}> = register$(() => {
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
});
export default App;
