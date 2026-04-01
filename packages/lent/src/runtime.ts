import { deserialize, renderClasslist, setAttribute, type ClassList, type EventHandler, type JSXElement } from ".";
import { patchElement, type JSXState } from "./patchElement";
import { listenForStoreReads, resumeStore, signals, subscribeToStoreReads, type StoreRead } from "./store";
import { assert, microtaskDebounce } from "./utils";

export const DIRECTIVE_PREFIX = "lentjs";
export type Directives = {
  signals: [string, any][],
  stores: [string, any][],

  "start-dynamic": { storeReads: StoreRead[], update: (previous?: JSXElement) => JSXElement },
  "end-dynamic": null,

  "start-array": null,
  "end-array": null,
  "array-element-separator": null,

  "null": null,
  "undefined": null,
};
export type DirectiveName = keyof Directives;
export type MarkerDirectiveName = keyof {
  [K in keyof Directives as Directives[K] extends null ? K : never]: Directives[K];
};
type DirectiveHelper<K> = K extends keyof Directives ? { name: K, data: Directives[K] } : never
export type Directive = DirectiveHelper<DirectiveName>;

type StateStackElement =
  | { kind: "dynamic-start", startDirective: Comment, storeReads: StoreRead[], update: (previous?: JSXElement) => JSXElement }
  | { kind: "array-start" }
  | { kind: "state", state: JSXState }
;
type RunCtx = {
  dynamicStateStack: StateStackElement[],
};

function handleDirective<D extends Directive>(ctx: RunCtx, directiveNode: Comment, parent: Node, d: D) {
  switch (d.name) {
  case "signals": {
    for (const [id, val] of d.data) {
      signals.set(id, {
        callbacks: [],
        currentValue: val,
      });
    }
    break;
  }
  case "stores": {
    for (const [id, val] of d.data) {
      resumeStore(id, val);
    }
    break;
  }
  case "start-dynamic": {
    const { storeReads, update } = d.data;

    ctx.dynamicStateStack.push({
      kind: "dynamic-start",
      startDirective: directiveNode,
      storeReads,
      update,
    });

    break;
  }
  case "end-dynamic": {
    const state = ctx.dynamicStateStack.pop();
    assert(state?.kind === "state");
    const dynamic = ctx.dynamicStateStack.pop();
    assert(dynamic?.kind === "dynamic-start");

    let resultState = state.state;
    const callback = dynamic.update;
    const unsubscribe = () => {
      currentUnsubscribe();
      return resultState;
    };

    const hh = microtaskDebounce(() => {
      const [previousResult, newStoreReads] = listenForStoreReads(() => callback(resultState.element));
      resultState = patchElement(parent, directiveNode, resultState, previousResult);
      currentUnsubscribe = subscribeToStoreReads(hh, newStoreReads, { once: true });
    });
    let currentUnsubscribe = subscribeToStoreReads(hh, dynamic.storeReads, { once: true });

    if (ctx.dynamicStateStack.length > 0)
      ctx.dynamicStateStack.push({
        kind: "state",
        state: {
          kind: "dynamic",
          startAnchor: dynamic.startDirective,
          endAnchor: directiveNode,
          element: callback,
          unsubscribe,
        },
      });

    break;
  }
  case "start-array": {
    ctx.dynamicStateStack.push({
      kind: "array-start",
    });
    break;
  }
  case "end-array": {
    const states: JSXState[] = [];
    while (ctx.dynamicStateStack.length > 0 && ctx.dynamicStateStack.at(-1)?.kind !== "array-start") {
      const el = ctx.dynamicStateStack.pop();
      assert(el?.kind === "state");
      states.push(el.state);
    }
    states.reverse();

    assert(ctx.dynamicStateStack.pop()?.kind === "array-start");
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "array", element: states.map(s => s.element), states } })
    break;
  }
  // Dummy directive, does nothing (makes sure text nodes are broken up)
  case "array-element-separator": break;
  case "null": {
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: null, node: null } })
    break;
  }
  case "undefined": {
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: undefined, node: null } })
    break;
  }
  default:
    d satisfies never;
  }
}

function handleHTMLElement(el: HTMLElement) {
  for (const t of el.attributes) {
    if (t.name.startsWith("lentjs:on:")) {
      const event = t.name.replace(/^lentjs:on:/, "");
      el.addEventListener(event, deserialize(t.value) as EventHandler<Event>);
    }

    if (t.name.startsWith("lentjs:attr:")) {
      const attr = t.name.replace(/^lentjs:attr:/, "");
      let { callback, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], callback: () => any };

      const hh = microtaskDebounce(() => {
        const [new_value, new_found_reads] = listenForStoreReads(() => callback());
        setAttribute(el, attr, new_value);
        subscribeToStoreReads(hh, new_found_reads, { once: true });
      });
      subscribeToStoreReads(hh, found_reads, { once: true });
    }

    if (t.name.startsWith("lentjs:class")) {
      let { update, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], update: () => ClassList };

      const hh = microtaskDebounce(() => {
        const [new_value, new_found_reads] = listenForStoreReads(() => update());
        el.className = "";
        el.classList.add(...renderClasslist(new_value));
        subscribeToStoreReads(hh, new_found_reads, { once: true });
      });
      subscribeToStoreReads(hh, found_reads, { once: true });
    }

    if (t.name.startsWith("lentjs:prop")) {
      const prop = t.name.replace(/^lentjs:prop:/, "");
      let { callback, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], callback: () => any };

      const hh = microtaskDebounce(() => {
        const [new_value, new_found_reads] = listenForStoreReads(() => callback());
        // @ts-ignore
        el[prop] = new_value;
        subscribeToStoreReads(hh, new_found_reads, { once: true });
      });
      subscribeToStoreReads(hh, found_reads, { once: true });
    }
  }
}

function domVisitor(ctx: RunCtx, node: ChildNode) {
  if (node instanceof HTMLElement)
    handleHTMLElement(node);

  node.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 2);
      if (parts[0] !== DIRECTIVE_PREFIX) return;
      const parts_rest = n.textContent.replace(/^([^ ]+ +){2}/, "");
      const directive = { name: parts[1], data: parts_rest !== n.textContent ? deserialize(parts_rest) : null } as unknown as Directive;
      handleDirective(ctx, n, node, directive);
      return;
    }

    if (ctx.dynamicStateStack.length > 0) {
      ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: n, node: n } })
    }

    domVisitor({ dynamicStateStack: [] }, n);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  const ctx: RunCtx = {
    dynamicStateStack: [],
  };
  domVisitor(ctx, rootElement);
  console.log(ctx);
  console.timeEnd("startRuntime");
}

