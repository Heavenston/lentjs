import { type ComponentFn, createStore, RefFor, register } from "@lentjs/core";
import c from "./todo.module.scss";

type TaskData = {
  id: string,
  text: string,
  done: boolean,
};

function createTask(text: string): TaskData {
  return createStore({ id: crypto.randomUUID(), text, done: false });
}

type TaskProps = {
  task: TaskData,
  onDelete: () => void,
};
const Task: ComponentFn<TaskProps> = register((props) => {
  "use component";

  return <div class={() => [c["task"], { [c["task-completed"]]: props.task.done }]}>
    <span>{() => props.task.text}</span>
    <input checked={() => props.task.done} attr:type="checkbox" on:change={e => {
      const el = e.currentTarget;
      if (!(el instanceof HTMLInputElement)) return;
      props.task.done = el.checked;
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
      createTask("Say Hello"),
      createTask("Say Bye"),
    ],
  });

  const areAllDone = () => state.tasks.every(t => t.done);

  return <>
    <form on:submit={e => {
      e.preventDefault();
      const el = e.currentTarget;
      if (!(el instanceof HTMLFormElement)) return;
      const trimmed = state.input_text.trim();
      if (!trimmed) return;
      state.tasks = [...state.tasks, createTask(trimmed)];
      state.input_text = "";
    }}>
      <input
        value={() => state.input_text}
        on:input={e => {
          const el = e.currentTarget;
          if (!(el instanceof HTMLInputElement)) return;
          state.input_text = el.value;
        }}
      />
      <button disabled={() => !state.input_text.trim()}>Create Task</button>
    </form>
    <button on:click={() => {
      const action = areAllDone();
      for (const task of state.tasks)
        task.done = !action;
    }} disabled={() => state.tasks.length <= 0}>
      Mark all as{() => areAllDone() ? " not" : null} done
    </button>
    <RefFor<TaskData>
      each={() => state.tasks}
      key={task => task.id}
      children={task => <Task task={task} onDelete={() => { state.tasks = state.tasks.filter(p => p.id !== task.id) }} />}
    >
    </RefFor>
  </>;
}, "____RANDOM_ID");
export default Todo;
