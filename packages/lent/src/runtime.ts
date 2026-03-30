import { Component, deserialize, patchElement, renderClasslist, setAttribute, type ClassList, type JSXElement, type JSXState, type JSXStateArray } from ".";
import { constructComponent } from "./component";
import { listenForStoreReads, resumeStore, signals, subscribeToStoreReads, type Store, type StoreRead } from "./store";
import { assert, microtaskDebounce } from "./utils";

function closureBind<F extends Function>(f: F, new_this: object | null): F {
  return f;

  // if (isFunction(f) && isClosure(f)) {
  //   return f;
  // }
  // if (isClassMethod(f) || isBindableThis(f)) {
  //   return f.bind(new_this);
  // }
  // else {
  //   // console.warn("Rebinding closure: ", f.toString());
  //   try {
  //     return new Function("return " + f.toString()).call(new_this);
  //   }
  //   catch(e) {
  //     console.error("Error rebinding:", e);
  //     // @ts-ignore
  //     return () => { throw new Error("Error rebinding this function") };
  //   }
  // }
}

export const DIRECTIVE_PREFIX = "lentjs";
export type Directives = {
  signals: [string, any][],
  stores: [string, any][],

  "start-component": { factoryId: string, componentId: string, props: object, state: Store<unknown> },
  "end-component": null,

  "start-dynamic": { storeReads: StoreRead[], update: (previous?: JSXElement) => JSXElement },
  "end-dynamic": null,

  "start-array": null,
  "end-array": null,
  "array-element-separator": null,

  "null": null,
};
export type DirectiveName = keyof Directives;
export type MarkerDirectiveName = keyof {
  [K in keyof Directives as Directives[K] extends null ? K : never]: Directives[K];
};
type DirectiveHelper<K> = K extends keyof Directives ? { name: K, data: Directives[K] } : never
export type Directive = DirectiveHelper<DirectiveName>;

type StateStackElement =
  | { kind: "dynamic-start", storeReads: StoreRead[], update: (previous?: JSXElement) => JSXElement }
  | { kind: "array-start" }
  | { kind: "state", state: JSXState }
;
type RunCtx = {
  component_stack: {
    factoryId: string,
    componentId: string,
    instance: Component<any, any> | null,
  }[],
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
  case "start-component":
    const { factoryId, componentId, props, state } = d.data;

    const factory = Component.getFactoryFromId(factoryId);
    if (!factory) {
      console.warn(`Could not find the component factory with id`, factoryId);
    }

    ctx.component_stack.push({
      factoryId,
      componentId,
      instance: factory ? constructComponent(factory, props, componentId, state) : null,
    });
    break;
  case "end-component":
    ctx.component_stack.pop();
    break;
  case "start-dynamic": {
    const { storeReads, update } = d.data;

    ctx.dynamicStateStack.push({
      kind: "dynamic-start",
      storeReads,
      update,
    });

    break;
  }
  case "end-dynamic": {
    const current_component = ctx.component_stack.at(-1)?.instance ?? null;

    const state = ctx.dynamicStateStack.pop();
    assert(state?.kind === "state");
    const dynamic = ctx.dynamicStateStack.pop();
    assert(dynamic?.kind === "dynamic-start");

    let resultState = state.state;
    const callback = closureBind(dynamic.update,current_component);
    const unsubscribe = () => currentUnsubscribe();

    let previousResult: JSXElement | undefined;

    const hh = microtaskDebounce(() => {
      let newStoreReads: StoreRead[];
      [previousResult, newStoreReads] = listenForStoreReads(() => callback(previousResult));
      resultState = patchElement(parent, resultState, previousResult);
      currentUnsubscribe = subscribeToStoreReads(hh, newStoreReads, { once: true });
    });
    let currentUnsubscribe = subscribeToStoreReads(hh, dynamic.storeReads, { once: true });

    if (ctx.dynamicStateStack.length > 0)
      ctx.dynamicStateStack.push({
        kind: "state",
        state: {
          kind: "dynamic",
          callback,
          resultState,
          unsubscribe,
          endAnchor: directiveNode,
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
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "array", endAnchor: directiveNode, states } })
    break;
  }
  // Dummy directive, does nothing
  case "array-element-separator":
    const last = ctx.dynamicStateStack.at(-1);
    assert(last?.kind === "state");
    last.state.endAnchor = directiveNode;
    break;
  case "null": {
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", endAnchor: directiveNode, node: null } })
    break;
  }
  default:
    d satisfies never;
  }
}

function handleHTMLElement(ctx: RunCtx, el: HTMLElement) {
  const current_comp = ctx.component_stack.at(-1)?.instance ?? null;
  for (const t of el.attributes) {
    if (t.name.startsWith("lentjs:on:")) {
      const event = t.name.replace(/^lentjs:on:/, "");
      // @ts-ignore
      const cb: any = closureBind(deserialize(t.value), current_comp);
      el.addEventListener(event, cb);
    }

    if (t.name.startsWith("lentjs:attr:")) {
      const attr = t.name.replace(/^lentjs:attr:/, "");
      let { callback, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], callback: () => any };

      callback = closureBind(callback, current_comp);

      const hh = microtaskDebounce(() => {
        const [new_value, new_found_reads] = listenForStoreReads(() => callback());
        setAttribute(el, attr, new_value);
        subscribeToStoreReads(hh, new_found_reads, { once: true });
      });
      subscribeToStoreReads(hh, found_reads, { once: true });
    }

    if (t.name.startsWith("lentjs:class")) {
      let { update, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], update: () => ClassList };

      update = closureBind(update, current_comp);

      const hh = microtaskDebounce(() => {
        const [new_value, new_found_reads] = listenForStoreReads(() => update());
        el.className = "";
        el.classList.add(...renderClasslist(new_value));
        subscribeToStoreReads(hh, new_found_reads, { once: true });
      });
      subscribeToStoreReads(hh, found_reads, { once: true });
    }
  }
}

function domVisitor(ctx: RunCtx, node: ChildNode) {
  if (ctx.dynamicStateStack.length > 0) {
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", endAnchor: null, node } })
  }

  if (node instanceof HTMLElement)
    handleHTMLElement(ctx, node);

  node.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 2);
      if (parts[0] !== DIRECTIVE_PREFIX) return;
      const parts_rest = n.textContent.replace(/^([^ ]+ +){2}/, "");
      const directive = { name: parts[1], data: parts_rest !== n.textContent ? deserialize(parts_rest) : null } as unknown as Directive;
      handleDirective(ctx, n, node, directive);
      return;
    }

    domVisitor(ctx, n);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  const ctx: RunCtx = {
    component_stack: [],
    dynamicStateStack: [],
  };
  domVisitor(ctx, rootElement);
  console.log(ctx);
  console.timeEnd("startRuntime");
}

