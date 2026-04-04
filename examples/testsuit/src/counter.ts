import { h, type ComponentFn, register, createSignal, createTask } from "@lentjs/core";

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

  createTask(({ track }) => {
    if (typeof document !== "undefined")
      alert(track(rawCount));
  });

  return h("div", {
    children: [
      h("div", {
        children: ["Count: ", count],
      }),
      h("div", {
        children: ["Digits: ", () => new Array(count()).fill(null).map((_val, idx) => `${idx} `)],
      }),
      h("button", {
        children: ["Increment to ", () => count()+1],
        "attr:disabled": () => count() >= props.max(),
        "on:click": () => {
          console.log(`Increment ${count()} -> ${count()+1}`);
          setCount.update(p => clamp(clamp(p)+1));
        },
      }),
      h("button", {
        children: ["Decrement to ", () => count()-1],
        "attr:disabled": () => count() <= props.min(),
        "on:click": () => {
          console.log(`Decrement ${count()} -> ${count()-1}`);
          setCount.update(p => clamp(clamp(p)-1));
        },
      }),
    ],
  });
}, "____RANDOM_ID");

const Counter: ComponentFn<{}> = register(() => {
  "use component";

  const [min, setMin] = createSignal(0);
  const [max, setMax] = createSignal(10);

  return h("div", {
    class: ["a", "b b"],
    children: [
      h("div", {
        children: [
          "Min: ",
          h("input", {
            "attr:type": "number",
            "attr:value": min,
            "attr:max": max,
            "on:change": (e) => {
              if (!(e instanceof Event)) return;
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              console.log(`Min Changed: ${el.valueAsNumber}`);
              setMin(el.valueAsNumber);
            },
          }),
        ],
      }),
      h("div", {
        children: [
          "Max: ",
          h("input", {
            "attr:type": "number",
            "attr:value": max,
            "attr:min": min,
            "on:change": (e) => {
              if (!(e instanceof Event)) return;
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              console.log(`Changed: ${el.valueAsNumber}`);
              setMax(el.valueAsNumber);
            },
          }),
        ],
      }),
      h(CounterButton, { min, max }),
    ],
  });
}, "____RANDOM_ID");
export default Counter;
