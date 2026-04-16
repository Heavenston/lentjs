import { type ComponentFn, createStore, RefFor, register, onUnmount, onResume, resumed, getScope } from "@lentjs/core";
import c from "./todo.module.scss";

type TaskData = {
  id: string,
  text: string,
  done: boolean,
};

function createTask(text: string, done: boolean = false): TaskData {
  return createStore({ id: crypto.randomUUID(), text, done });
}

type TaskProps = {
  task: TaskData,
  onDelete: () => void,
};
const Task: ComponentFn<TaskProps> = register((props) => {
  "use component";

  console.log("Creation of task component", props.task.text);
  onResume(() => {
    console.log("Resume of task component", props.task.text);
  });
  onUnmount(() => {
    console.log("Unmount of component", props.task.text);
  });
  getScope().onCleanup(() => {
    if (!resumed()) return;
    console.log("Cleanup of component", props.task.text);
  });

  return <div class={[c["task"], { [c["task-completed"]]: props.task.done }]}>
    <span>{props.task.text}</span>
    <input checked={props.task.done} attr:type="checkbox" on:change={e => {
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
      createTask("Say Hello", true),
      createTask("Say Bye"),
    ],
  });
  const proposedTaskName = () => `Task #${state.tasks.length}`;

  const areAllDone = () => state.tasks.every(t => t.done);

  return <>
    <form on:submit={e => {
      e.preventDefault();
      const el = e.currentTarget;
      if (!(el instanceof HTMLFormElement)) return;
      const name = state.input_text.trim() || proposedTaskName();
      state.tasks = [...state.tasks, createTask(name)];
      state.input_text = "";
    }}>
      <input
        value={state.input_text}
        attr:placeholder={proposedTaskName()}
        on:input={e => {
          const el = e.currentTarget;
          if (!(el instanceof HTMLInputElement)) return;
          state.input_text = el.value;
        }}
      />
      <button>Create Task</button>
    </form>
    <button on:click={() => {
      const action = areAllDone();
      for (const task of state.tasks)
        task.done = !action;
    }} disabled={state.tasks.length <= 0}>
      Mark all as{areAllDone() ? " not" : null} done
    </button>
    <RefFor<TaskData>
      each={state.tasks}
      key={task => task.id}
    >
      {task => <Task task={task} onDelete={() => { state.tasks = state.tasks.filter(p => p.id !== task.id) }} />}
    </RefFor>
  </>;
}, "____RANDOM_ID");
export default Todo;
