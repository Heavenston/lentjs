import { isSSRElement, type JSXElement, type JSXElementSingular } from ".";
import { listenForStoreReads, subscribeToStoreReads } from "./store";
import { assert, isFunction, microtaskDebounce } from "./utils";

export type JSXStateCommon = { endAnchor: ChildNode | null };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & { kind: "dynamic", resultState: JSXState, callback: unknown, unsubscribe: () => void };
export type JSXStateArray = JSXStateCommon & { kind: "array", states: JSXState[] }
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
    return { kind: "singular", endAnchor, node: null };
  }

  if (previousState?.node == null) {
    const childAsNode = typeof child === "string" || typeof child === "number" ? document.createTextNode(child.toString()) : child;
    parent.insertBefore(childAsNode, endAnchor);
    return { kind: "singular", endAnchor, node: childAsNode };
  }
  else if (previousState.node instanceof Text && (typeof child === "string" || typeof child === "number")) {
    previousState.node.textContent = child.toString();
    return { kind: "singular", endAnchor, node: previousState.node };
  }
  else {
    const childAsNode = typeof child === "string" || typeof child === "number" ? document.createTextNode(child.toString()) : child;
    parent.replaceChild(previousState.node, childAsNode);
    return { kind: "singular", endAnchor, node: childAsNode };
  }
}

export function patchElement(parent: Node, previousState: JSXState | null, child: JSXElement): JSXState {
  const endAnchor = previousState?.endAnchor ?? null;

  assert(endAnchor === null || endAnchor.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState?.kind === "dynamic") {
    if (previousState.callback !== child) {
      previousState.unsubscribe();
      return patchElement(parent, previousState.resultState, child);
    }
    else {
      // Nothing to do, same callback
      return previousState;
    }
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
      callback: child,
      resultState,
      unsubscribe: () => currentUnsubscribe(),

      endAnchor,
    };
  }
  
  if (Array.isArray(child)) {
    if (previousState?.kind !== "array") {
      previousState = {
        kind: "array",
        states: previousState === null ? [] : [previousState],
        endAnchor,
      };
    }

    // let currentAnchor = nextSibling;
    const newState: JSXStateArray = {
      kind: "array",
      states: [],
      endAnchor,
    };

    let currentAnchor = endAnchor;
    for (let i = Math.max(previousState.states.length, child.length)-1; i >= 0; i--) {
      const temporaryAnchor = new Comment("anchor");
      parent.insertBefore(temporaryAnchor, currentAnchor);

      const elState: JSXState = previousState.states[i] ? { ...previousState.states[i]!, endAnchor: currentAnchor } : { kind: "singular", endAnchor: currentAnchor, node: null };
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
