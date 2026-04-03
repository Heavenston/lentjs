import { h, closure, type ComponentFn, register, createSignal } from "@lentjs/core";

type CounterButtonProps = {
  min: () => number,
  max: () => number,
};
const CounterButton: ComponentFn<CounterButtonProps> = register(props => {
  const [count, setCount] = createSignal(props.min());

  const clamp = closure((min, max, val: number): number => {
    if (val > max())
      return max();
    if (val < min())
      return min();
    return val;
  }, props.min, props.max);

  return h("div", {
    children: [
      h("div", {
        children: ["Count: ", count],
      }),
      h("div", {
        children: ["Digits: ", closure(count => new Array(count()).fill(null).map((_val, idx) => `${idx} `), count)],
      }),
      h("button", {
        children: ["Increment to ", closure(count => count()+1, count)],
        "attr:disabled": closure((count, max) => count() >= max(), count, props.max),
        "on:click": closure((clamp, count, setCount) => {
          console.log(`Increment ${count()} -> ${count()+1}`);
          setCount(clamp(count()+1));
        }, clamp, count, setCount),
      }),
      h("button", {
        children: ["Decrement to ", closure(count => count()-1, count)],
        "attr:disabled": closure((count, min) => count() <= min(), count, props.min),
        "on:click": closure((clamp, count, setCount) => {
          console.log(`Decrement ${count()} -> ${count()-1}`);
          setCount(clamp(count()-1));
        }, clamp, count, setCount),
      }),
    ],
  });
}, "____RANDOM_ID");

const Counter: ComponentFn<{}> = register(() => {
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
            "on:change": closure((setMin, e) => {
              if (!(e instanceof Event)) return;
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              console.log(`Min Changed: ${el.valueAsNumber}`);
              setMin(el.valueAsNumber);
            }, setMin),
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
            "on:change": closure((setMax, e) => {
              if (!(e instanceof Event)) return;
              const el = e.currentTarget;
              if (!(el instanceof HTMLInputElement)) return;
              console.log(`Changed: ${el.valueAsNumber}`);
              setMax(el.valueAsNumber);
            }, setMax)
          }),
        ],
      }),
      h(CounterButton, { min, max }),
    ],
  });
}, "____RANDOM_ID");
export default Counter;
