import { type ComponentFn, createSignal, createTask, type EventHandler, For, getScope, register$ } from "@lentjs/core";
import { AppContextId } from "./app";
import { createUid } from "@lentjs/utils";

type CounterButtonProps = {
  min: number,
  max: number,
};
const CounterButton: ComponentFn<CounterButtonProps> = register$(props => {
  const [rawCount, setCount] = createSignal(props.min);

  const clamp = (val: number): number => {
    if (val > props.max)
      return props.max;
    if (val < props.min)
      return props.min;
    return val;
  };
  const count = () => clamp(rawCount());

  createTask(() => {
    const val = rawCount();
    console.log("Task!", val);
    getScope().onCleanup(() => {
      console.log("Count task cleanup", val);
    });
  });

  getScope().onCleanup(() => {
    console.log("Count component onCleanup");
  });

  const increment = () => {
    console.log(`Increment ${count()} -> ${count()+1}`);
    setCount.update(p => clamp(clamp(p)+1));
  };
  const decrement = () => {
    console.log(`Decrement ${count()} -> ${count()-1}`);
    setCount.update(p => clamp(clamp(p)-1));
  };

  return <div>
    <div>Count: {count()}</div>
    <div>Digits: <For each={new Array<null>(count() - props.min).fill(null)}>{(idx) => <>{idx + props.min}{" "}</>}</For></div>
    <button
      attr:disabled={count() >= props.max}
      on:click={increment}
    >
      Increment to {count()+1}
    </button>
    <button
      attr:disabled={count() <= props.min}
      on:click={decrement}
    >
      Decrement to {count()-1}
    </button>
  </div>;
});

const Counter: ComponentFn<{}> = register$(() => {
  const [min, setMin] = createSignal(0);
  const [max, setMax] = createSignal(10);

  const onChangeMin: EventHandler<Event> = (e) => {
    const el = e.currentTarget;
    if (!(el instanceof HTMLInputElement)) return;
    console.log(`Min Changed: ${el.valueAsNumber}`);
    setMin(el.valueAsNumber);
  };
  const onChangeMax: EventHandler<Event> = (e) => {
    const el = e.currentTarget;
    if (!(el instanceof HTMLInputElement)) return;
    console.log(`Max Changed: ${el.valueAsNumber}`);
    setMax(el.valueAsNumber);
  };

  return <div class={["a", "b b"]}>
    <div>{typeof document === "undefined" ? "Server" : "Client"}{" "}{createUid()}</div>
    <div>
      App context id: {getScope().getContext(AppContextId)}
    </div>
    <div>
      Min: <input attr:type="number" attr:value={min()} attr:max={max()} on:change={onChangeMin} />
    </div>
    <div>
      Max: <input attr:type="number" attr:value={max()} attr:min={min()} on:change={onChangeMax} />
    </div>
    <CounterButton min={min()} max={max()} />
  </div>
});
export default Counter;
