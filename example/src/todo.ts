import { h, Component, type JSXElement, createStore, For } from "lent";
import c from "./todo.module.scss";

type TaskState = {
  id: string,
  text: string,
  done: boolean,
};

type TaskProps = {
  task: () => TaskState,
  onDelete?: () => void,
};
class Task extends Component<{}, TaskProps> {
  private c = c;

  static { this.register("____RANDOM_ID") }

  protected getInitialState(): {} { return {} }

  protected init(): void {
    console.log("Props: ", this.props);
    console.log("Task:", this.props.task, "=", this.props.task());
  }

  private onChangeDone(e: Event) {
    const el = e.currentTarget;
    if (!(el instanceof HTMLInputElement)) return;
    this.props.task().done = el.checked;
  }

  override render(): JSXElement {
    return h("div", {
      class: () => [this.c["task"], { [this.c["task-completed"]]: this.props.task().done }],
      children: [
        h("span", {
          children: () => this.props.task().text,
        }),
        h("input", {
          "checked": () => this.props.task().done,

          "attr:type": "checkbox",
          "on:change": this.onChangeDone,
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
        createStore({
          id: crypto.randomUUID(),
          done: false,
          text: "Hi!",
        }),
      ],
    };
  }

  private addTask(text: string): string {
    const id = crypto.randomUUID();
    this.state.tasks = [...this.state.tasks, createStore({
      id,
      done: false,
      text,
    })];
    return id;
  }

  private deleteTask(id: string) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
  }

  private taskRender(_idx: number, task: () => TaskState) {
    return h(Task, {
      task,
      onDelete: () => {
        console.log("delete :(");
        this.deleteTask(task().id);
      },
    });
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
                console.log("change", this);
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
            children: this.taskRender,
          }),
        }),
      ],
    });
  }
}
