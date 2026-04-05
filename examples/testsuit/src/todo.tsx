import { type ComponentFn, createStore, RefFor, createSignal, register } from "@lentjs/core";
import c from "./todo.module.scss";

type TaskData = {
  id: string,
  text: string,
};

type TaskProps = {
  task: TaskData,
  onDelete: () => void,
};
const Task: ComponentFn<TaskProps> = register((props) => {
  "use component";

  const [done, setDone] = createSignal(false);

  return <div class={() => [c["task"], { [c["task-completed"]]: done() }]}>
    <span>{() => props.task.text}</span>
    <input checked={done} attr:type="checkbox" on:change={e => {
      const el = e.currentTarget;
      if (!(el instanceof HTMLInputElement)) return;
      setDone(el.checked);
    }} />
    <button on:click={() => props.onDelete()}>
      Delete
    </button>
  </div>;
}, "____RANDOM_ID");

type TodoState = {
  input_text: string,
  tasks: TaskData[],
};
const Todo: ComponentFn<{}> = register(() => {
  "use component";

  const state = createStore<TodoState>({
    input_text: "Hi",
    tasks: [
      createStore({ id: crypto.randomUUID(), text: "Say Hello" }),
      createStore({ id: crypto.randomUUID(), text: "Say Bye" }),
    ],
  });

  return <>
    <form on:submit={e => {
      e.preventDefault();
      const el = e.currentTarget;
      if (!(el instanceof HTMLFormElement)) return;
      const trimmed = state.input_text.trim();
      if (!trimmed) return;
      state.tasks = [...state.tasks, {
        id: crypto.randomUUID(),
        text: trimmed,
      }];
      state.input_text = "";
    }}>
      <input
        prop:value={() => state.input_text}
        attr:value={state.input_text}
        on:input={e => {
          const el = e.currentTarget;
          if (!(el instanceof HTMLInputElement)) return;
          state.input_text = el.value;
        }}
      />
      <button attr:disabled={() => !state.input_text.trim()}>Create Task</button>
    </form>
    <>
      <RefFor<TaskData>
        each={() => state.tasks}
        key={task => task.id}
        children={task => <Task task={task} onDelete={() => { state.tasks = state.tasks.filter(p => p.id !== task.id) }} />}
      >
      </RefFor>
    </>
  </>;
}, "____RANDOM_ID");
export default Todo;
