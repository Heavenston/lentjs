import { createSignal, h, RefFor, register, type ComponentFn, type SignalAccessor, type SignalSetter } from "@lentjs/core";
import c from "./list.module.scss";

function createElement(): Element {
  return { id: crypto.randomUUID().split("-")[0] };
}
register(createElement, "____RANDOM_ID");

type Element = { id: string };
const elementRender = register((setElements: SignalSetter<Element[]>, element: Element, getIdx: SignalAccessor<number>) => {
  "use component";

  const i = crypto.randomUUID().split("-")[0];

  return h("div", {
    "attr:id": `el-${element.id}`,
    class: c.element,
    children: [
      `${element.id}: `,
      h("button", {
        children: "+",
        "on:click": () => {
          const idx = getIdx();
          setElements.update(elements => {
            const newEl = createElement();
            console.log("Adding",newEl.id,"before",elements[idx].id);
            elements.splice(idx, 0, newEl);
            return [...elements];
          });
        },
      }),
      h("button", {
        children: "Swap With Previous",
        "on:click": () => {
          const idx = getIdx();
          setElements.update(elements => {
            if (idx === 0) return elements;
            const prev = elements[idx-1];
            console.log("Swap", prev.id, "with", elements[idx].id);
            elements[idx-1] = elements[idx];
            elements[idx] = prev;
            return [...elements];
          });
        },
      }),
      h("button", {
        children: ["Delete ", i],
        "on:click": () => {
          setElements.update(els => els.filter(e => e.id !== element.id));
        },
      }),
      h("button", {
        children: "Swap With Next",
        "on:click": () => {
          const idx = getIdx();
          setElements.update(elements => {
            if (idx+1 >= elements.length) return elements;
            const next = elements[idx+1];
            console.log("Swap", next.id, "with", elements[idx].id);
            elements[idx+1] = elements[idx];
            elements[idx] = next;
            return [...elements];
          });
        },
      }),
      h("button", {
        children: "+",
        "on:click": () => {
          const idx = getIdx();
          setElements.update(elements => {
            const newEl = createElement();
            console.log("Adding",newEl.id,"after",elements[idx].id);
            elements.splice(idx+1, 0, newEl);
            return [...elements];
          });
        },
      }),
    ],
  });
}, "____RANDOM_ID");

const List: ComponentFn<{}> = register(() => {
  "use component";
  const [elements, setElements] = createSignal<Element[]>(
    new Array(3).fill(null).map(createElement)
  );

  return [
    h("div", {
      children: ["Count: ", () => elements().length],
    }),
    h("div", {
      children: ["List: ", () => elements().map(p => p.id).join(", ")],
    }),
    h(RefFor<Element>, {
      each: elements,
      key: el => el.id,
      children: elementRender.bind(null, setElements),
    }),
  ];
}, "____RANDOM_ID");
export default List;
