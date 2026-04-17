import { Scope, type JSXElement, type JSXElementDynamic } from ".";
import { getHandlerForAttribute } from "./attributes";
import { changeStateAnchor, cleanupStateNodes, getFirstElement, getLastElement, patchElement, removeStateNodes, type JSXState, type JSXStateDynamic } from "./patchElement";
import { type CapturedReactivityData, resumeReaction, resumeTask, untrack, type TaskCaptureData } from "@lentjs/core-reactivity";
import { assert, noop, notNull, unreachable } from "@lentjs/utils";
import { deserialize } from "@lentjs/core-serialize";
import { setResumed } from "./global-signals";
import { ChildrenArray } from "./children-array";

const REMOVE_DIRECTIVES = true;

export const DIRECTIVE_PREFIX = "lentjs";
export const ATTRIBUTE_PREFIX = `data-${DIRECTIVE_PREFIX}`;

export type Directives = {
  "tasks": TaskCaptureData,

  "dyn": {
    isComputedInArray: boolean,
    update: JSXElementDynamic,
    reactivityData: CapturedReactivityData,
  },
  "dyn/": null,

  "sco": Scope,
  "sco/": null,

  "arr": null,
  "arr/": null,

  "chi": null,
  "chi/": null,

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
  | { kind: "children-array-start" }
  | { kind: "state", state: JSXState, isComputedInArray?: false }
  | { kind: "state", state: JSXStateDynamic, isComputedInArray: true }
;
type RunCtx = {
  directivesData: readonly unknown[],
  nodesToRemove: (ChildNode | Attr)[],
  dynamicStateStack: StateStackElement[],
  scopeStack: Scope[],
};

function handleDirective<D extends Directive>(ctx: RunCtx, directiveNode: Comment, parent: Node, d: D) {
  switch (d.name) {
  case "tasks":
    ctx.nodesToRemove.push(directiveNode);
    for (const task of d.data.capturedTasks) {
      Scope.enter(task.parentScope, () => {
        resumeTask(task.task, task.reactivityData);
      });
    }
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

    let unsub: (() => void) = noop;
    if (isStatic) {
      ctx.nodesToRemove.push(startAnchor, endAnchor);
    }
    else {
      const scope = notNull(ctx.scopeStack.at(-1));
      unsub = resumeReaction(() => scope.enter(() => {
        const newJSXElement = dynamic.data.update(resultState.element);
        untrack(() => {
          resultState = patchElement(parent, endAnchor, resultState, newJSXElement);
        });
      }), dynamic.data.reactivityData);
    }

    if (ctx.dynamicStateStack.length > 0)
      ctx.dynamicStateStack.push({
        kind: "state",
        isComputedInArray: dynamic.data.isComputedInArray,
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
  case "sco": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.scopeStack.push(d.data);
    break;
  }
  case "sco/": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.scopeStack.pop();
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
  case "chi": {
    ctx.nodesToRemove.push(directiveNode);
    ctx.dynamicStateStack.push({
      kind: "children-array-start",
    });
    break;
  }
  case "chi/": {
    ctx.nodesToRemove.push(directiveNode);
    let states: JSXState[] = [];
    let elements = new ChildrenArray<JSXElement>;
    while (ctx.dynamicStateStack.length > 0 && ctx.dynamicStateStack.at(-1)?.kind !== "children-array-start") {
      const el = ctx.dynamicStateStack.pop();
      assert(el?.kind === "state");
      if (el.isComputedInArray) {
        elements.computed(el.state.element);
      }
      else {
        elements.child(el.state.element);
      }
      states.push(el.state);
    }
    states.reverse();

    assert(ctx.dynamicStateStack.pop()?.kind === "array-start");
    ctx.dynamicStateStack.push({ kind: "state", state: { kind: "array", element: elements, states } })
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
      const data = ctx.directivesData[parseInt(t.value)] as ResumeAttributesData;
      for (const [k, v] of data) {
        const handler = notNull(getHandlerForAttribute(k));
        ctx.scopeStack.at(-1)!.enter(() => {
          handler.setOnHTMLElement(el, k, v);
        });
      }
    }
    if (t.name === `${ATTRIBUTE_PREFIX}:dyn-attrs`) {
      const data = ctx.directivesData[parseInt(t.value)] as DynamicAttributesData;
      for (const [reactivityData, propName, callback] of data) {
        const handler = notNull(getHandlerForAttribute(propName));
        ctx.scopeStack.at(-1)!.enter(() => resumeTask(() => {
          const val = callback();
          untrack(() => handler.setOnHTMLElement(el, propName, val));
        }, reactivityData));
      }
    }
  }
}

function domVisitor(ctx: RunCtx, node: ChildNode) {
  if (node instanceof HTMLElement)
    handleHTMLElement(ctx, node);

  node.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 3);
      if (parts[0] !== DIRECTIVE_PREFIX) return;
      const directive = {
        name: parts[1],
        data: parts.length > 2 ? ctx.directivesData[parseInt(parts[2]!)] : null,
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
      scopeStack: ctx.scopeStack,
    }, n);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  const dataElement = rootElement.querySelector(`*[${ATTRIBUTE_PREFIX}\\:data]`);
  assert(dataElement !== null, "Could not find the data script element");
  assert(dataElement instanceof HTMLScriptElement && dataElement.lang === "application/json");
  console.log("Size of data:", dataElement.innerText.toString().length);
  const ctx: RunCtx = {
    directivesData: deserialize(dataElement.innerText) as any,
    nodesToRemove: [],
    dynamicStateStack: [],
    scopeStack: [],
  };
  domVisitor(ctx, rootElement);
  assert(ctx.dynamicStateStack.length === 0);
  console.log(ctx.nodesToRemove.length, "total directive nodes and attributes found");
  if (REMOVE_DIRECTIVES && localStorage.getItem("LENTJS_KEEP_DIRECTIVES") === null)
    for (const n of ctx.nodesToRemove) {
      if (n instanceof Attr)
        n.ownerElement?.removeAttributeNode(n);
      else
        n.remove();
    }

  notNull(ctx.scopeStack[0]).enter(() => {
    setResumed();
  });

  console.timeEnd("startRuntime");
}

