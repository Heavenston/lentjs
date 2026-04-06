import { type ComponentFn, register, createSignal, createTask, type EventHandler, For, onCleanup, getOwner } from "@lentjs/core";

type CounterButtonProps = {
  min: () => number,
  max: () => number,
};
const CounterButton: ComponentFn<CounterButtonProps> = register(props => {
  "use component";

  const [rawCount, setCount] = createSignal(props.min());

  const clamp = (val: number): number => {
    if (val > props.max())
      return props.max();
    if (val < props.min())
      return props.min();
    return val;
  };
  const count = () => clamp(rawCount());

  createTask(() => {
    const val = rawCount();
    console.log("Task!", val);
    onCleanup(() => {
      console.log("Count task cleanup", val);
    });
  });

  onCleanup(() => {
    console.log("Count component onCleanup");
  });

  return <div>
    <div>Count: {() => count()}</div>
    <div>Digits: <For each={() => new Array<null>(count() - props.min()).fill(null)}>{(idx) => () => `${idx + props.min()} `}</For></div>
    <button
      attr:disabled={() => count() >= props.max()}
      on:click={() => {
        console.log(`Increment ${count()} -> ${count()+1}`);
        setCount.update(p => clamp(clamp(p)+1));
      }}
    >
      Increment to {() => count()+1}
    </button>
    <button
      attr:disabled={() => count() <= props.min()}
      on:click={() => {
        console.log(`Increment ${count()} -> ${count()-1}`);
        setCount.update(p => clamp(clamp(p)-1));
      }}
    >
      Decrement to {() => count()-1}
    </button>
  </div>;
}, "____RANDOM_ID");

const Counter: ComponentFn<{}> = register(() => {
  "use component";

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
    <div>
      Min: <input attr:type="number" attr:value={min()} attr:max={max} on:change={onChangeMin} />
    </div>
    <div>
      Max: <input attr:type="number" attr:value={max()} attr:min={min} on:change={onChangeMax} />
    </div>
    <CounterButton min={min} max={max} />
  </div>
}, "____RANDOM_ID");
export default Counter;
