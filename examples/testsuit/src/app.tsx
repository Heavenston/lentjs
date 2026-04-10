import { type ComponentFn, register, createSignal, Show, createContextId, provideContext } from "@lentjs/core";
import Counter from "./counter";
import Todo from "./todo";
import List from "./list";

export const AppContextId = createContextId<string>("____RANDOM_ID");

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

  provideContext(AppContextId, "Within ContitionalCounter");

  const [show, setShow] = createSignal(true);
  
  return <>
    <button on:click={() => setShow.update(u => !u)}>
      {show() ? "Hide" : "Show"}
    </button>
    <Show when={show}>
      {/* () => <Counter /> */() => <div>{crypto.randomUUID()} HI!</div>}
    </Show>
  </>;
}, "____RANDOM_ID");

const App: ComponentFn<{}> = register(() => {
  "use component";

  provideContext(AppContextId, "Within app");

  // return <>
  //   <Counter />
  //   <hr />
  //   <ConditionalCounter />
  //   <hr />
  //   <Todo />
  //   <hr />
  //   <Complex />
  //   <hr />
  //   <List />
  // </>;
  return <>
    <ConditionalCounter />
  </>;
}, "____RANDOM_ID");
export default App;
