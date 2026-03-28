import { h, Component, type JSXElement, createStore, For } from "lent";

type TaskState = {
  text: string,
  done: boolean,
};

type TaskProps = {
  task: () => TaskState,
};
class Task extends Component<{}, TaskProps> {
  protected getInitialState(): {} { return {} }

  override render(): JSXElement {
    return h("div", {
      class: () => ["task", { "task-completed": this.props.task().done }],
      children: [
        h("span", {
          children: () => this.props.task().text,
        }),
        h("input", {
          "attr:type": "checkbox",
          "attr:checked": () => this.props.task().done ? "" : undefined,
          "on:change": (e) => {
            const el = e.currentTarget;
            if (!(el instanceof HTMLInputElement)) return;
            this.props.task().done = el.checked;
          },
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
  protected override getInitialState(): TodoState {
    return {
      input_text: "Example",
      tasks: [
        createStore({ text: "Bonjour!", done: false }),
        createStore({ text: "Aurevoir!", done: true }),
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
            this.addTask(this.state.input_text);
            el.reset();
          },
          children: [
            h("input", {
              "value": () => this.state.input_text,
              "on:change": e => {
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                this.state.input_text = el.value;
              },
            }),
            h("button", {
              children: "create",
            }),
          ],
        }),

        h("div", {
          children: h(For<TaskState>, {
            each: () => this.state.tasks,
            children: (_idx, task) => h(Task, { task }),
          }),
        }),
      ],
    });
  }
}
