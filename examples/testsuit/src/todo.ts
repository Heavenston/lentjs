import { h, type ComponentFn, createStore, RefFor, createSignal, register } from "@lentjs/core";
import c from "./todo.module.scss";

type TaskData = {
  id: string,
  text: string,
};

type TaskProps = {
  task: TaskData,
  onDelete: (id: string) => void,
};
const Task: ComponentFn<TaskProps> = register((props) => {
  "use component";

  const [done, setDone] = createSignal(false);

  return h("div", {
    class: () => [c["task"], { [c["task-completed"]]: done() }],
    children: [
      h("span", {
        children: () => props.task.text,
      }),
      h("input", {
        "checked": done,

        "attr:type": "checkbox",
        "on:change": (e) => {
          const el = e.currentTarget;
          if (!(el instanceof HTMLInputElement)) return;
          setDone(el.checked);
        },
      }),
      h("button", {
        "on:click": () => {
          props.onDelete(props.task.id);
        },
        children: "delete",
      }),
    ],
  });
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

  return h("div", {
    children: [
      h("form", {
        "on:submit": (e) => {
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
        },
        children: [
          h("input", {
            "prop:value": () => state.input_text,
            "attr:value": state.input_text,
            "on:input": (e) => {
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              state.input_text = el.value;
            },
          }),
          h("button", {
            children: "Create Task",
            "attr:disabled": () => !state.input_text.trim(),
          }),
        ],
      }),

      h("div", {
        class: ["tasks-container"],
        children: h(RefFor<TaskData>, {
          each: () => state.tasks,
          key: task => task.id,
          children: task => h(Task, {
            task,
            onDelete: () => {
              state.tasks = state.tasks.filter(p => p.id !== task.id);
            },
          }),
        }),
      }),
    ],
  });
}, "____RANDOM_ID");
export default Todo;
