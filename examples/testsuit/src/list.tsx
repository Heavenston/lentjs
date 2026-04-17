import { createSignal, RefFor, register$, type ComponentFn, type SignalSetter } from "@lentjs/core";
import c from "./list.module.scss";

function createElement(): Element {
  return { id: crypto.randomUUID().split("-")[0] };
}

type Element = { id: string };
const ElementComp: ComponentFn<{ elements: Element[], setElements: SignalSetter<Element[]>, element: Element, idx: number }> = register$(props => {
  const i = crypto.randomUUID().split("-")[0];

  return <div
    attr:id={`el-${props.element.id}`}
    class={c.element}
  >
    {props.element.id} ({props.idx+1}/{props.elements.length}):{" "}
    <button
      on:click={() => {
        props.setElements.update(elements => {
          const newEl = createElement();
          console.log("Adding",newEl.id,"before",elements[props.idx].id);
          elements.splice(props.idx, 0, newEl);
          return [...elements];
        });
      }}
    >
      +
    </button>
    <button
      disabled={props.idx === 0}
      on:click={() => {
        const idx = props.idx;
        props.setElements.update(elements => {
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
        props.setElements.update(els => els.filter(e => e.id !== props.element.id));
      }}
    >
      Delete {i}
    </button>
    <button
      disabled={props.idx+1 === props.elements.length}
      on:click={() => {
        const idx = props.idx;
        props.setElements.update(elements => {
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
        const idx = props.idx;
        props.setElements.update(elements => {
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
});

const List: ComponentFn<{}> = register$(() => {
  const [elements, setElements] = createSignal<Element[]>(
    new Array(3).fill(null).map(createElement)
  );

  return [
    <div>
      Count: {elements().length}
    </div>,
    <div>
      List: {elements().map(p => p.id).join(", ")}
    </div>,
    <RefFor<Element>
      each={elements()}
      key={el => el.id}
    >
      {(element, idx) => <ElementComp element={element} idx={idx()} elements={elements()} setElements={setElements} />}
    </RefFor>,
  ];
});
export default List;
