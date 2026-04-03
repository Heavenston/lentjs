import { h, type ComponentFn, createStore, closure, RefFor, createSignal, register } from "@lentjs/core";
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
  const [done, setDone] = createSignal(false);

  return h("div", {
    class: closure((c, done) => [c["task"], { [c["task-completed"]]: done() }], c, done),
    children: [
      h("span", {
        children: closure(task => task.text, props.task),
      }),
      h("input", {
        "checked": done,

        "attr:type": "checkbox",
        "on:change": closure((setDone, e) => {
          const el = e.currentTarget;
          if (!(el instanceof HTMLInputElement)) return;
          setDone(el.checked);
        }, setDone),
      }),
      h("button", {
        "on:click": closure((onDelete, task) => {
          onDelete(task.id);
        }, props.onDelete, props.task),
        children: "delete",
      }),
    ],
  });
}, "____RANDOM_ID");

type TodoState = {
  input_text: string,
  tasks: TaskData[],
};
const taskRender = register((state: TodoState, task: TaskData) => {
  return h(Task, {
    task,
    onDelete: closure((state, task) => {
      state.tasks = state.tasks.filter(p => p.id !== task.id);
    }, state, task),
  });
}, "____RANDOM_ID");
const Todo: ComponentFn<{}> = register(() => {
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
        "on:submit": closure((state, e) => {
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
        }, state),
        children: [
          h("input", {
            "prop:value": closure(state => state.input_text, state),
            "attr:value": state.input_text,
            "on:input": closure((state, e) => {
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              state.input_text = el.value;
            }, state),
          }),
          h("button", {
            children: "Create Task",
            "attr:disabled": closure(state => !state.input_text.trim(), state),
          }),
        ],
      }),

      h("div", {
        class: ["tasks-container"],
        children: h(RefFor<TaskData>, {
          each: closure(state => state.tasks, state),
          key: closure(task => task.id),
          children: closure(taskRender, state),
        }),
      }),
    ],
  });
}, "____RANDOM_ID");
export default Todo;
