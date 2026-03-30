import { h, Component, type JSXElement, createStore, For, closure } from "lent";
import c from "./todo.module.scss";
import { bind } from "lent/src/serialize";

type TaskState = {
  id: string,
  text: string,
  done: boolean,
};

type TaskProps = {
  task: () => TaskState,
  onDelete: (id: string) => void,
};
class Task extends Component<{}, TaskProps> {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): {} { return {} }

  private onChangeDone(e: Event) {
    const el = e.currentTarget;
    if (!(el instanceof HTMLInputElement)) return;
    this.props.task().done = el.checked;
  }

  override render(): JSXElement {
    return h("div", {
      class: closure((c, self) => [c["task"], { [c["task-completed"]]: self.props.task().done }], c, this),
      children: [
        h("span", {
          children: closure(self => self.props.task().text, this),
        }),
        h("input", {
          "checked": closure(self => self.props.task().done, this),

          "attr:type": "checkbox",
          "on:change": bind(this.onChangeDone, this),
        }),
        h("button", {
          "on:click": closure(self => {
            console.log(self.props);
            self.props.onDelete(self.props.task().id);
          }, this),
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
      onDelete: bind(this.deleteTask, this),
    });
  }

  override render(): JSXElement {
    return h("div", {
      children: [
        h("form", {
          "on:submit": closure((self, e) => {
            e.preventDefault();
            const el = e.currentTarget;
            if (!(el instanceof HTMLFormElement)) return;
            const trimmed = self.state.input_text.trim();
            if (!trimmed) return;
            self.addTask(trimmed);
            self.state.input_text = "";
          }, this),
          children: [
            h("input", {
              "prop:value": closure(self => self.state.input_text, this),
              "attr:value": this.state.input_text,
              "on:input": closure((self, e) => {
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                self.state.input_text = el.value;
              }, this),
            }),
            h("button", {
              children: "Create Task",
              "attr:disabled": closure(self => !self.state.input_text.trim(), this),
            }),
          ],
        }),

        h("div", {
          class: ["tasks-container"],
          children: h(For<TaskState>, {
            each: closure(self => self.state.tasks, this),
            children: bind(this.taskRender, this),
          }),
        }),
      ],
    });
  }
}
