import { createSignal, RefFor, register, type ComponentFn, type SignalAccessor, type SignalSetter } from "@lentjs/core";
import c from "./list.module.scss";

function createElement(): Element {
  return { id: crypto.randomUUID().split("-")[0] };
}
register(createElement, "____RANDOM_ID");

type Element = { id: string };
const elementRender = register((setElements: SignalSetter<Element[]>, element: Element, getIdx: SignalAccessor<number>) => {
  "use component";

  const i = crypto.randomUUID().split("-")[0];

  return <div
    attr:id={`el-${element.id}`}
    class={c.element}
  >
    {element.id}:{" "}
    <button
      on:click={() => {
        const idx = getIdx();
        setElements.update(elements => {
          const newEl = createElement();
          console.log("Adding",newEl.id,"before",elements[idx].id);
          elements.splice(idx, 0, newEl);
          return [...elements];
        });
      }}
    >
      +
    </button>
    <button
      on:click={() => {
        const idx = getIdx();
        setElements.update(elements => {
          if (idx === 0) return elements;
          const prev = elements[idx-1];
          console.log("Swap", prev.id, "with", elements[idx].id);
          elements[idx-1] = elements[idx];
          elements[idx] = prev;
          return [...elements];
        });
      }}
    >
      Swap With Previous
    </button>
    <button
      on:click={() => {
        setElements.update(els => els.filter(e => e.id !== element.id));
      }}
    >
      Delete {i}
    </button>
    <button
      on:click={() => {
        const idx = getIdx();
        setElements.update(elements => {
          if (idx+1 >= elements.length) return elements;
          const next = elements[idx+1];
          console.log("Swap", next.id, "with", elements[idx].id);
          elements[idx+1] = elements[idx];
          elements[idx] = next;
          return [...elements];
        });
      }}
    >
      Swap With Next
    </button>
    <button
      on:click={() => {
        const idx = getIdx();
        setElements.update(elements => {
          const newEl = createElement();
          console.log("Adding",newEl.id,"after",elements[idx].id);
          elements.splice(idx+1, 0, newEl);
          return [...elements];
        });
      }}
    >
      +
    </button>
  </div>;
}, "____RANDOM_ID");

const List: ComponentFn<{}> = register(() => {
  "use component";

  const [elements, setElements] = createSignal<Element[]>(
    new Array(3).fill(null).map(createElement)
  );

  return [
    <div>
      Count: {() => elements().length}
    </div>,
    <div>
      List: {() => elements().map(p => p.id).join(", ")}
    </div>,
    <RefFor<Element>
      each={elements}
      key={el => el.id}
    >
      {elementRender.bind(null, setElements)}
    </RefFor>,
  ];
}, "____RANDOM_ID");
export default List;
