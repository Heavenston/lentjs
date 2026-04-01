import { closure, createSignal, h, RefFor, register, type ComponentFn } from "lent";
import type { SignalAccessor, SignalSetter } from "lent/src/store";
import c from "./list.module.scss";

function createElement(): Element {
  return { id: crypto.randomUUID().split("-")[0] };
}
register(createElement, "____RANDOM_ID");

type Element = { id: string };
const elementRender = register((setElements: SignalSetter<Element[]>, element: Element, idx: SignalAccessor<number>) => {
  const i = crypto.randomUUID().split("-")[0];

  return h("div", {
    class: c.element,
    children: [
      `${element.id}: `,
      h("button", {
        children: "+",
        "on:click": closure((createElement, setElements, getIdx) => {
          const idx = getIdx();
          setElements.update(elements => {
            elements.splice(idx, 0, createElement());
            return [...elements];
          });
        }, createElement, setElements, idx),
      }),
      h("button", {
        children: "Swap With Previous",
        "on:click": closure((setElements, getIdx) => {
          const idx = getIdx();
          setElements.update(elements => {
            if (idx === 0) return elements;
            const prev = elements[idx-1];
            elements[idx-1] = elements[idx];
            elements[idx] = prev;
            return [...elements];
          });
        }, setElements, idx),
      }),
      h("button", {
        children: ["Delete ", i],
        "on:click": closure((setElements, id) => {
          setElements.update(els => els.filter(e => e.id !== id));
        }, setElements, element.id),
      }),
      h("button", {
        children: "Swap With Next",
        "on:click": closure((setElements, getIdx) => {
          const idx = getIdx();
          setElements.update(elements => {
            if (idx+1 >= elements.length) return elements;
            const next = elements[idx+1];
            elements[idx+1] = elements[idx];
            elements[idx] = next;
            return [...elements];
          });
        }, setElements, idx),
      }),
      h("button", {
        children: "+",
        "on:click": closure((createElement, setElements, getIdx) => {
          const idx = getIdx();
          setElements.update(elements => {
            elements.splice(idx+1, 0, createElement());
            return [...elements];
          });
        }, createElement, setElements, idx),
      }),
    ],
  });
}, "____RANDOM_ID");
const List: ComponentFn<{}> = register(() => {
  const [elements, setElements] = createSignal<Element[]>(
    new Array(5).fill(null).map(createElement)
  );

  return [
    h("div", {
      children: ["Count: ", closure(g => g().length, elements)],
    }),
    h("div", {
      children: ["List: ", closure(g => g().map(p => p.id).join(", "), elements)],
    }),
    h(RefFor<Element>, {
      each: closure(getEls => {
        console.log(getEls());
        return getEls();
      }, elements),
      key: closure(el => el.id),
      children: closure(elementRender, setElements),
    }),
  ];
}, "____RANDOM_ID");
export default List;
