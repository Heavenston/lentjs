import { h, Component, type JSXElement, createStore, For } from "lent";
import c from "./todo.module.scss";

type TaskState = {
  text: string,
  done: boolean,
};

type TaskProps = {
  task: () => TaskState,
  onDelete?: () => void,
};
class Task extends Component<{}, TaskProps> {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): {} { return {} }

  override render(): JSXElement {
    return h("div", {
      class: () => [c["task"], { [c["task-completed"]]: this.props.task().done }],
      children: [
        h("span", {
          children: () => this.props.task().text,
        }),
        h("input", {
          "checked": () => this.props.task().done,

          "attr:type": "checkbox",
          "on:change": (e) => {
            const el = e.currentTarget;
            if (!(el instanceof HTMLInputElement)) return;
            this.props.task().done = el.checked;
          },
        }),
        h("button", {
          "on:click": () => {
            this.props.onDelete?.();
          },
          children: "delete",
        }),
      ],
    });
  }
}

type TodoState = {
  input_text: string,
  tasks: TaskState[],
};

export default class Todo extends Component<TodoState> {
  static { this.register("____RANDOM_ID") }

  protected override getInitialState(): TodoState {
    return {
      input_text: "",
      tasks: [
        {
          done: false,
          text: "Hi!",
        },
      ],
    };
  }

  addTask(text: string) {
    this.state.tasks = [...this.state.tasks, createStore({
      done: false,
      text,
    })];
  }

  override render(): JSXElement {
    return h("div", {
      children: [
        h("form", {
          "on:submit": (e) => {
            e.preventDefault();
            const el = e.currentTarget;
            if (!(el instanceof HTMLFormElement)) return;
            const trimmed = this.state.input_text.trim();
            if (!trimmed) return;
            this.addTask(trimmed);
            this.state.input_text = "";
          },
          children: [
            h("input", {
              "value": () => this.state.input_text,
              "on:input": e => {
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                this.state.input_text = el.value;
              },
            }),
            h("button", {
              children: "Create Task",
              "attr:disabled": () => !this.state.input_text.trim(),
            }),
          ],
        }),

        h("div", {
          children: h(For<TaskState>, {
            each: () => this.state.tasks,
            children: (_idx, task) => h(Task, {
              task,
              onDelete: () => {
                console.log("delete :(");
                this.state.tasks = this.state.tasks.filter(t => t !== task());
              },
            }),
          }),
        }),
      ],
    });
  }
}
