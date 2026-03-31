import { isSSRElement, type JSXElement, type JSXElementArray, type JSXElementDynamic, type JSXElementSingular } from ".";
import { listenForStoreReads, subscribeToStoreReads } from "./store";
import { assert, isFunction, microtaskDebounce } from "./utils";

export type JSXStateCommon = { kind: string, endAnchor: ChildNode | null, element: JSXElement };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", element: JSXElementSingular, node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & { kind: "dynamic", element: JSXElementDynamic, unsubscribe: () => JSXState };
export type JSXStateArray = JSXStateCommon & { kind: "array", element: JSXElementArray, states: JSXState[] }
export type JSXState = JSXStateSingular | JSXStateArray | JSXStateDynamic;

function getFirstAnchorElement(state: JSXState): ChildNode | "no-node" | "dynamic" {
  switch (state.kind) {
  case "singular":
    return state.node ?? state.endAnchor ?? "no-node";
  case "array":
    for (const s of state.states) {
      const potentialAnchor = getFirstAnchorElement(s);
      if (potentialAnchor === "dynamic") return "dynamic";
      if (potentialAnchor === "no-node") continue;
      return potentialAnchor;
    }
    return state.endAnchor ?? "no-node";
  case "dynamic":
    return "dynamic";
  }
}

export function patchElementSingular(parent: Node, previousState: JSXStateSingular | null, child: JSXElementSingular): JSXStateSingular {
  const endAnchor = previousState?.endAnchor ?? null;

  assert(endAnchor === null || endAnchor.parentNode === parent, "Invalid end anchor");
  assert(previousState === null || previousState.node === null || previousState.node.parentNode === parent, "Invalid node");
  assert(!isSSRElement(child), "Unexpected ssr element during rendering");

  if (child == null) {
    if (previousState?.node != null)
      parent.removeChild(previousState.node);
    return { kind: "singular", element: child, endAnchor, node: null };
  }

  if (previousState?.node == null) {
    const childAsNode = typeof child === "string" || typeof child === "number" ? document.createTextNode(child.toString()) : child;
    parent.insertBefore(childAsNode, endAnchor);
    return { kind: "singular", element: child, endAnchor, node: childAsNode };
  }
  else if (previousState.node instanceof Text && (typeof child === "string" || typeof child === "number")) {
    previousState.node.textContent = child.toString();
    return { kind: "singular", element: child, endAnchor, node: previousState.node };
  }
  else {
    const childAsNode = typeof child === "string" || typeof child === "number" ? document.createTextNode(child.toString()) : child;
    if (previousState?.node === childAsNode) {
      // Do nothing
    }
    else {
      parent.replaceChild(childAsNode, previousState.node);
    }
    return { kind: "singular", element: child, endAnchor, node: childAsNode };
  }
}

export function patchElementArray(parent: Node, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElement[]): JSXStateArray {
  const endAnchor = previousState?.endAnchor ?? null;

  if (previousState?.kind !== "array") {
    previousState = {
      kind: "array",
      states: previousState === null ? [] : [previousState],
      endAnchor,
      element: child,
    };
  }

  // let currentAnchor = nextSibling;
  const newState: JSXStateArray = {
    kind: "array",
    states: [],
    endAnchor,
    element: child,
  };

  let currentAnchor = endAnchor;
  for (let i = Math.max(previousState.states.length, child.length)-1; i >= 0; i--) {
    const temporaryAnchor = new Comment("anchor");
    parent.insertBefore(temporaryAnchor, currentAnchor);

    const elState: JSXState = previousState.states[i] ? { ...previousState.states[i]!, endAnchor: currentAnchor } : { kind: "singular", element: undefined, endAnchor: currentAnchor, node: null };
    const outState = patchElement(parent, elState, child[i]);
    newState.states.push(outState);

    const possibleNewAnchor = getFirstAnchorElement(outState);
    switch (possibleNewAnchor) {
    case "dynamic":
      currentAnchor = temporaryAnchor;
      break;
    default:
      currentAnchor = possibleNewAnchor;
    case "no-node":
      parent.removeChild(temporaryAnchor);
    }
  }
  newState.states.reverse();
  return newState;
}

export function patchElementArrayNew(parent: Node, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElement[]): JSXStateArray {
  const endAnchor = previousState?.endAnchor ?? null;

  if (previousState?.kind !== "array") {
    previousState = {
      kind: "array",
      element: child,
      states: previousState === null ? [] : [previousState],
      endAnchor,
    };
  }

  type Operation =
    | { kind: "add", element: number, anchor: number | ChildNode | null }
    | { kind: "remove", element: JSXElement, anchor: number | ChildNode | null }
  ;
  const operations = new Array<Operation>();

  function anchorToJSXElement(val: number | ChildNode | null): JSXElement {
    return typeof val === "number"
      ? child[val]
      : val;
  }
  function compare(a: JSXElement, b: JSXElement) {
    if (a === b)
      return true;
    if (typeof a === "string" || typeof a === "number") {
      if (b instanceof Text)
        return b.textContent === a.toString();
      else
        return false;
    }
    if (typeof b === "string" || typeof b === "number") {
      if (a instanceof Text)
        return a.textContent === b.toString();
      else
        return false;
    }
    return false;
  }

  const size = Math.max(previousState.states.length, child.length);
  let currentInsertAnchor: number | null = null;
  for (let index = size-1; index >= 0; index--) {
    if (index < previousState.states.length) {
      operations.push({ kind: "remove", element: previousState.states[index]!.element, anchor: previousState.states[index]!.endAnchor })
    }
    if (index < child.length) {
      operations.push({ kind: "add", element: index, anchor: currentInsertAnchor })
      currentInsertAnchor = index;
    }
  }

  console.log("step1:",{previousState, child, operations});

  for (let i = 0; i < operations.length; i++) {
    const op1 = operations[i]!;
    for (let j = i+1; j < operations.length; j++) {
      const op2 = operations[j]!;
      if (op1.kind === "add" && op2.anchor === op1.anchor) {
        op2.anchor = op1.element;
      }
      else if (op1.kind === "remove" && anchorToJSXElement(op2.anchor) === op1.element) {
        op2.anchor = op1.anchor;
      }
    }
  }

  console.log("step2:",operations);

  for (let i = 0; i < operations.length; i++) {
    const op1 = operations[i]!;
    for (let j = i+1; j < operations.length; j++) {
      const op2 = operations[j]!;
      if (op1.kind === "remove" && op2.kind === "add" && op1.anchor === op2.anchor && compare(op1.element, child[op2.element])) {
        for (let k = i+1; k < j; k++) {
          if (operations[k]!.anchor === op1.anchor) {
            operations[k]!.anchor = op2.element;
          }
        }
        operations.splice(j, 1);
        operations.splice(i, 1);
        i--;
        break;
      }
    }
  }

  console.log("step3:",operations);

  throw new Error();
}

export function patchElement(parent: Node, previousState: JSXState | null, child: JSXElement): JSXState {
  if (previousState !== null && previousState.element === child) return previousState;

  const endAnchor = previousState?.endAnchor ?? null;

  assert(endAnchor === null || endAnchor.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState?.kind === "dynamic") {
    return patchElement(parent, previousState.unsubscribe(), child);
  }

  if (isFunction(child)) {
    let [newChild, storeReads] = listenForStoreReads(() => child());
    let resultState = patchElement(parent, previousState, newChild);

    const hh = microtaskDebounce(() => {
      [newChild, storeReads] = listenForStoreReads(() => child(newChild));
      resultState = patchElement(parent, resultState, newChild);
      
      currentUnsubscribe = subscribeToStoreReads(hh, storeReads, { once: true });
    });
    let currentUnsubscribe = subscribeToStoreReads(hh, storeReads, { once: true });

    return {
      kind: "dynamic",
      element: child,
      unsubscribe: () => {
        currentUnsubscribe();
        return resultState;
      },
      endAnchor,
    };
  }
  
  if (Array.isArray(child)) {
    return patchElementArrayNew(parent, previousState, child);
  }
  else {
    child satisfies JSXElementSingular;

    if (previousState === null || previousState.kind === "singular") {
      return patchElementSingular(parent, previousState, child);
    }
    else {
      throw new Error("todo");
    }
  }
}
