import type { JSXElement, OwnerCleanup } from ".";
import { getHandlerForAttribute } from "./attributes";
import { changeStateAnchor, cleanupStateNodes, getFirstElement, getLastElement, patchElement, removeStateNodes, type JSXState } from "./patchElement";
import { onCleanup, createOwner, enterOwner, type CapturedReactivityData, type CapturedTaskData, resumeTask, resumeReaction } from "@lentjs/core-reactivity";
import { assert, noop, unreachable } from "./utils";
import type { Owner } from "@lentjs/core-reactivity/src/owner-internal";
import { deserialize } from "@lentjs/core-serialize";

const REMOVE_DIRECTIVES = false;

export const DIRECTIVE_PREFIX = "lentjs";
export const ATTRIBUTE_PREFIX = `data-${DIRECTIVE_PREFIX}`;

export type Directives = {
  "directives-data": unknown[],

  "dyn": {
    update: (previous?: JSXElement) => JSXElement,
    reactivityData: CapturedReactivityData,
    tasks: CapturedTaskData[],
  },
  "dyn/": null,

  "arr": null,
  "arr/": null,
  "sep": null,

  "nul": null,
  "und": null,
};
export type DirectiveName = keyof Directives;
export type MarkerDirectiveName = keyof {
  [K in keyof Directives as Directives[K] extends null ? K : never]: Directives[K];
};
type DirectiveHelper<K> = K extends keyof Directives ? { name: K, data: Directives[K] } : never
export type Directive = DirectiveHelper<DirectiveName>;

export type ResumeAttributesData = [propName: string, value: unknown][];
export type DynamicAttributesData = [reactivityData: CapturedReactivityData, propName: string, callback: () => unknown][];

type StateStackElement =
  | { kind: "dynamic-start", startDirective: Comment, data: Directives["dyn"] }
  | { kind: "array-start" }
  | { kind: "state", state: JSXState }
;
type RunCtx = {
  directivesData: readonly unknown[] | null,
  nodesToRemove: (ChildNode | Attr)[],
  dynamicStateStack: StateStackElement[],
};

function handleDirective<D extends Directive>(ctx: RunCtx, directiveNode: Comment, parent: Node, d: D) {
  switch (d.name) {
  case "directives-data":
    ctx.nodesToRemove.push(directiveNode);
    ctx.directivesData = d.data;
    break;
  case "dyn": {
    ctx.dynamicStateStack.push({
      kind: "dynamic-start",
      startDirective: directiveNode,
      data: d.data,
    });

    break;
  }
  case "dyn/": {
    const stateFromStack = ctx.dynamicStateStack.pop();
    assert(stateFromStack?.kind === "state");
    const dynamic = ctx.dynamicStateStack.pop();
    assert(dynamic?.kind === "dynamic-start");

    const isStatic = dynamic.data.reactivityData.length === 0;
    const startAnchor = dynamic.startDirective;
    const endAnchor = directiveNode;

    let resultState = stateFromStack.state;

    for (const data of dynamic.data.tasks) {
      resumeTask(...data);
    }

    let unsub: (() => void) = noop;
    if (isStatic) {
      ctx.nodesToRemove.push(startAnchor, endAnchor);
    }
    else {
      unsub = resumeReaction(() => {
        const newJSXElement = dynamic.data.update(resultState.element);
        resultState = patchElement(parent, endAnchor, resultState, newJSXElement);
      }, dynamic.data.reactivityData);
    }

    if (ctx.dynamicStateStack.length > 0)
      ctx.dynamicStateStack.push({
        kind: "state",
        state: {
          kind: "dynamic",
          startAnchor: isStatic ? getFirstElement(resultState) : startAnchor,
          endAnchor: isStatic ? getLastElement(resultState) : endAnchor,
          element: dynamic.data.update,
          cleanup() {
            unsub();
            cleanupStateNodes(resultState);
          },
          remove() {
            this.cleanup();
            if (!isStatic) {
              startAnchor.remove();
              endAnchor.remove();
            }
            removeStateNodes(resultState);
          },
          changeAnchor(newAnchor) {
            console.log("Anchor change")
            if (isStatic) {
              changeStateAnchor(parent, resultState, newAnchor);
            }
            else {
              parent.insertBefore(startAnchor, newAnchor);
              parent.insertBefore(endAnchor, newAnchor);
              changeStateAnchor(parent, resultState, endAnchor);
            }
          },
        },
      });

    break;
  }
  case "arr": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({
      kind: "array-start",
    });
    break;
  }
  case "arr/": {
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
  case "sep":
    ctx.nodesToRemove.push(directiveNode);
    break;
  case "nul": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: null, node: null } })
    break;
  }
  case "und": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "singular", element: undefined, node: null } })
    break;
  }
  default:
    unreachable(d);
  }
}

function handleHTMLElement(ctx: RunCtx, el: HTMLElement) {
  for (const t of el.attributes) {
    if (t.name.startsWith(ATTRIBUTE_PREFIX))
      ctx.nodesToRemove.push(t);

    if (t.name === `${ATTRIBUTE_PREFIX}:res-attrs`) {
      const data = ctx.directivesData![parseInt(t.value)] as ResumeAttributesData;
      for (const [k, v] of data) {
        const handler = getHandlerForAttribute(k);
        assert(handler !== null);
        handler.setOnHTMLElement(el, k, v);
      }
    }
    if (t.name === `${ATTRIBUTE_PREFIX}:dyn-attrs`) {
      const data = ctx.directivesData![parseInt(t.value)] as DynamicAttributesData;
      for (const [reactivityData, propName, callback] of data) {
        const handler = getHandlerForAttribute(propName);
        assert(handler !== null);
        assert(handler.managedDynamic);
        resumeReaction(() => handler.setOnHTMLElement(el, propName, callback()), reactivityData);
      }
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
  enterOwner(createOwner(), () => {
    domVisitor(ctx, rootElement);
  });
  assert(ctx.dynamicStateStack.length === 0);
  console.log(ctx.nodesToRemove.length, "total directive nodes and attributes found");
  if (REMOVE_DIRECTIVES)
    for (const n of ctx.nodesToRemove) {
      if (n instanceof Attr)
        n.ownerElement?.removeAttributeNode(n);
      else
        n.remove();
    }
  console.timeEnd("startRuntime");
}

