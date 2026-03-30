import { h, Component, type JSXElement, createTask, closure } from "lent";

type CounterButtonState = {
  count: number,
};
type CounterButtonProps = {
  min: () => number,
  max: () => number,
};
class CounterButton extends Component<CounterButtonState, CounterButtonProps> {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): CounterButtonState {
    return {
      count: this.props.min(),
    };
  }

  protected override init(): void {
    // createTask(({ track }) => {
    //   const val = this.state.count;
    //   this.state.count = track(() => this.clamp(val));
    // });
  }

  clamp(val: number) {
    const max = this.props.max();
    const min = this.props.min();

    if (val > max)
      return max;
    if (val < min)
      return min;
    return val;
  }

  render(): JSXElement {
    return h("div", {
      children: [
        h("div", {
          children: ["Count: ", closure(state => state.count, this.state)],
        }),
        h("button", {
          children: ["Increment to ", closure(state => state.count + 1, this.state)],
          "attr:disabled": closure(self => self.state.count >= self.props.max(), this),
          "on:click": closure(self => {
            console.log(`Increment ${self.state.count} -> ${self.state.count+1}`);
            self.state.count = self.clamp(self.state.count+1);
          }, this),
        }),
        h("button", {
          children: ["Decrement to ", closure(self => self.clamp(self.state.count-1), this)],
          "attr:disabled": closure(self => self.state.count <= self.props.min(), this),
          "on:click": closure(self => {
            console.log(`Decrement ${self.state.count} -> ${self.state.count-1}`);
            self.state.count = self.clamp(self.state.count-1);
          }, this),
        }),
      ],
    });
  }
}

type CounterState = {
  min: number,
  max: number,
};
export default class Counter extends Component<CounterState> {
  static { this.register("____RANDOM_ID") }

  protected getInitialState(): CounterState {
    return {
      min: 0,
      max: 10,
    };
  }
  
  render(): JSXElement {
    return h("div", {
      class: ["a", "b b"],
      children: [
        h("div", {
          children: [
            "Min: ",
            h("input", {
              "attr:type": "number",
              "attr:value": this.state.min,
              "attr:max": this.state.max,
              "on:change": closure((self, e) => {
                if (!(e instanceof Event)) return;
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                console.log(`Min Changed: ${el.valueAsNumber}`);
                self.state.min = el.valueAsNumber;
              }, this),
            }),
          ],
        }),
        h("div", {
          children: [
            "Max: ",
            h("input", {
              "attr:type": "number",
              "attr:value": this.state.max,
              "attr:min": this.state.min,
              "on:change": closure((self, e) => {
                if (!(e instanceof Event)) return;
                const el = e.currentTarget;
                if (!(el instanceof HTMLInputElement)) return;
                console.log(`Changed: ${el.valueAsNumber}`);
                self.state.max = el.valueAsNumber;
              }, this)
            }),
          ],
        }),
        h(CounterButton, {
          min: closure(self => self.state.min, this),
          max: closure(self => self.state.max, this),
        }),
      ],
    });
  }
}

