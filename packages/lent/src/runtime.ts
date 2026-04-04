import { deserialize, renderClasslist, setAttribute, type AttributeValue, type ClassList, type EventHandler, type JSXElement } from ".";
import { changeStateAnchor, patchElement, type JSXState } from "./patchElement";
import { listenForStoreReads, resumeStore, signals, subscribeToStoreReads, type StoreRead } from "./store";
import { assert, microtaskDebounce } from "./utils";

const REMOVE_DIRECTIVES = true;

export const DIRECTIVE_PREFIX = "lentjs";
export type Directives = {
  "directives-data": unknown[],

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

export type DynamicValueData<R = any> = [
  storeReads: StoreRead[],
  callback: () => R,
];

type StateStackElement =
  | { kind: "dynamic-start", startDirective: Comment, storeReads: StoreRead[], update: (previous?: JSXElement) => JSXElement }
  | { kind: "array-start" }
  | { kind: "state", state: JSXState }
;
type RunCtx = {
  directivesData: readonly unknown[] | null,
  nodesToRemove: ChildNode[],
  dynamicStateStack: StateStackElement[],
};

function handleDirective<D extends Directive>(ctx: RunCtx, directiveNode: Comment, parent: Node, d: D) {
  switch (d.name) {
  case "directives-data":
    ctx.nodesToRemove.push(directiveNode);
    ctx.directivesData = d.data;
    break;
  case "signals": {
    ctx.nodesToRemove.push(directiveNode);
    for (const [id, val] of d.data) {
      signals.set(id, {
        callbacks: [],
        currentValue: val,
      });
    }
    break;
  }
  case "stores": {
    ctx.nodesToRemove.push(directiveNode);
    for (const [id, val] of d.data) {
      resumeStore(id, val);
    }
    break;
  }
  case "start-dynamic": {
    if (REMOVE_DIRECTIVES)
      directiveNode.textContent = `${DIRECTIVE_PREFIX} start-dynamic`;

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
    if (REMOVE_DIRECTIVES)
      directiveNode.textContent = `${DIRECTIVE_PREFIX} end-dynamic`;

    const state = ctx.dynamicStateStack.pop();
    assert(state?.kind === "state");
    const dynamic = ctx.dynamicStateStack.pop();
    assert(dynamic?.kind === "dynamic-start");

    const startAnchor = dynamic.startDirective;
    const endAnchor = directiveNode;

    let resultState = state.state;
    const callback = dynamic.update;
    const unsubscribe = () => {
      startAnchor.remove();
      endAnchor.remove();
      currentUnsubscribe();
      return resultState;
    };

    const hh = microtaskDebounce(() => {
      const [previousResult, newStoreReads] = listenForStoreReads(() => callback(resultState.element));
      resultState = patchElement(parent, endAnchor, resultState, previousResult);
      currentUnsubscribe = subscribeToStoreReads(hh, newStoreReads, { once: true });
    });
    let currentUnsubscribe = subscribeToStoreReads(hh, dynamic.storeReads, { once: true });

    if (ctx.dynamicStateStack.length > 0)
      ctx.dynamicStateStack.push({
        kind: "state",
        state: {
          kind: "dynamic",
          startAnchor: startAnchor,
          endAnchor: endAnchor,
          element: callback,
          unsubscribe,
          changeAnchor: (newAnchor) => {
            parent.insertBefore(startAnchor, newAnchor);
            parent.insertBefore(endAnchor, newAnchor);
            changeStateAnchor(parent, resultState, endAnchor);
          },
        },
      });

    break;
  }
  case "start-array": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({
      kind: "array-start",
    });
    break;
  }
  case "end-array": {
    ctx.nodesToRemove.push(directiveNode);
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
  case "array-element-separator":
    ctx.nodesToRemove.push(directiveNode);
    break;
  case "null": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: null, node: null } })
    break;
  }
  case "undefined": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: undefined, node: null } })
    break;
  }
  default:
    d satisfies never;
  }
}

function handleHTMLElement(ctx: RunCtx, el: HTMLElement) {
  for (const t of el.attributes) {
    if (t.name.startsWith(`${DIRECTIVE_PREFIX}:on:`)) {
      const event = t.name.slice(0, DIRECTIVE_PREFIX.length + 4);
      el.addEventListener(event, ctx.directivesData![parseInt(t.value)] as EventHandler<Event>);
    }

    if (t.name.startsWith(`${DIRECTIVE_PREFIX}:attr:`)) {
      const attr = t.name.slice(0, DIRECTIVE_PREFIX.length + 6);
      let [storeReads, callback] = ctx.directivesData![parseInt(t.value)] as DynamicValueData<AttributeValue>;

      const hh = microtaskDebounce(() => {
        const [newValue, newStoreReads] = listenForStoreReads(() => callback());
        setAttribute(el, attr, newValue);
        subscribeToStoreReads(hh, newStoreReads, { once: true });
      });
      subscribeToStoreReads(hh, storeReads, { once: true });
    }

    if (t.name === `${DIRECTIVE_PREFIX}:class`) {
      let [storeReads, callback] = ctx.directivesData![parseInt(t.value)] as DynamicValueData<ClassList>;

      const hh = microtaskDebounce(() => {
        const [newValue, newStoreReads] = listenForStoreReads(() => callback());
        el.className = "";
        el.classList.add(...renderClasslist(newValue));
        subscribeToStoreReads(hh, newStoreReads, { once: true });
      });
      subscribeToStoreReads(hh, storeReads, { once: true });
    }

    if (t.name.startsWith(`${DIRECTIVE_PREFIX}:prop:`)) {
      const prop = t.name.slice(0, DIRECTIVE_PREFIX.length + 6);
      let [storeReads, callback] = ctx.directivesData![parseInt(t.value)] as DynamicValueData<JSXElement>;

      const hh = microtaskDebounce(() => {
        const [newValue, newStoreReads] = listenForStoreReads(() => callback());
        // @ts-ignore
        el[prop] = newValue;
        subscribeToStoreReads(hh, newStoreReads, { once: true });
      });
      subscribeToStoreReads(hh, storeReads, { once: true });
    }
  }
}

function domVisitor(ctx: RunCtx, node: ChildNode) {
  if (node instanceof HTMLElement)
    handleHTMLElement(ctx, node);

  node.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 2);
      if (parts[0] !== DIRECTIVE_PREFIX) return;
      const parts_rest = n.textContent.replace(/^([^ ]+ +){2}/, "");
      const directive = {
        name: parts[1],
          data: parts_rest !== n.textContent
          ? /^[0-9]+$/.test(parts_rest)
          ? ctx.directivesData![parseInt(parts_rest)]
          : deserialize(parts_rest)
          : null,
      } as unknown as Directive;
      handleDirective(ctx, n, node, directive);
      return;
    }

    if (ctx.dynamicStateStack.length > 0) {
      ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: n, node: n } })
    }

    domVisitor({
      directivesData: ctx.directivesData,
      nodesToRemove: ctx.nodesToRemove,
      dynamicStateStack: [],
    }, n);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  const ctx: RunCtx = {
    directivesData: null,
    nodesToRemove: [],
    dynamicStateStack: [],
  };
  domVisitor(ctx, rootElement);
  assert(ctx.dynamicStateStack.length === 0);
  if (REMOVE_DIRECTIVES)
    for (const n of ctx.nodesToRemove)
      n.remove();
  console.timeEnd("startRuntime");
}

