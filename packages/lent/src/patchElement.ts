import { isJSXElementString, isSSRElement, type JSXElement, type JSXElementArray, type JSXElementDynamic, type JSXElementSingular } from ".";
import { listenForStoreReads, subscribeToStoreReads } from "./store";
import { assert, filterInPlace, isFunction, microtaskDebounce } from "./utils";

export type JSXStateCommon = { kind: string, element: JSXElement };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", element: JSXElementSingular, node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & { kind: "dynamic", startAnchor: ChildNode | null, endAnchor: ChildNode | null, element: JSXElementDynamic, unsubscribe: () => JSXState };
export type JSXStateArray = JSXStateCommon & { kind: "array", element: JSXElementArray, states: JSXState[] }
export type JSXState = JSXStateSingular | JSXStateArray | JSXStateDynamic;

function getFirstAnchorElement(state: JSXState): ChildNode | null {
  switch (state.kind) {
  case "singular":
    return state.node;
  case "array":
    for (const s of state.states) {
      const potentialAnchor = getFirstAnchorElement(s);
      if (potentialAnchor !== null)
        return potentialAnchor;
    }
    return null;
  case "dynamic":
    return state.startAnchor;
  }
}

function removeStateNodes(state: JSXState) {
  switch (state.kind) {
  case "singular":
    state.node?.remove();
    break;
  case "array":
    state.states.forEach(removeStateNodes);
    break;
  case "dynamic":
    state.startAnchor?.remove();
    state.endAnchor?.remove();
    removeStateNodes(state.unsubscribe());
    break;
  }
}

function compareEl(a: JSXElement, b: JSXElement) {
  // Null elements are never the same
  if (a == null || b == null)
    return false;
  if (a === b)
    return true;
  if (isJSXElementString(a)) {
    if (isJSXElementString(b))
      return a.toString() === b.toString();
    else if (b instanceof Text)
      return b.textContent === a.toString();
    else
      return false;
  }
  if (isJSXElementString(b)) {
    if (isJSXElementString(a))
      return a.toString() === b.toString();
    else if (a instanceof Text)
      return a.textContent === b.toString();
    else
      return false;
  }
  return false;
}

function patchElementSingular(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | null, child: JSXElementSingular): JSXStateSingular {
  assert(anchorElement === null || anchorElement.parentNode === parent, "Invalid end anchor");
  assert(previousState === null || previousState.node === null || previousState.node.parentNode === parent, "Invalid node");
  assert(!isSSRElement(child), "Unexpected ssr element during rendering");

  if (child == null) {
    if (previousState?.node != null)
      parent.removeChild(previousState.node);
    return { kind: "singular", element: child, node: null };
  }

  if (previousState?.node == null) {
    const childAsNode = isJSXElementString(child) ? document.createTextNode(child.toString()) : child;
    parent.insertBefore(childAsNode, anchorElement);
    return { kind: "singular", element: child, node: childAsNode };
  }
  else if (previousState.node instanceof Text && isJSXElementString(child)) {
    const newText = child.toString();
    if (previousState.node.textContent !== newText)
      previousState.node.textContent = newText;
    return { kind: "singular", element: child, node: previousState.node };
  }
  else {
    const childAsNode = isJSXElementString(child) ? document.createTextNode(child.toString()) : child;
    if (previousState?.node === childAsNode) {
      // Do nothing
    }
    else {
      parent.replaceChild(childAsNode, previousState.node);
    }
    return { kind: "singular", element: child, node: childAsNode };
  }
}

function patchElementDynamic(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElementDynamic): JSXStateDynamic {
  let [newChild, storeReads] = listenForStoreReads(() => child());

  if (storeReads.length === 0) {
    const resultState = patchElement(parent, anchorElement, previousState, newChild);
    return {
      kind: "dynamic",
      startAnchor: null,
      endAnchor: null,
      element: child,
      unsubscribe: () => resultState,
    };
  }
  else {
    const dynamicStartAnchor = new Comment("lentjs start-dynamic-anchor");
    const dynamicEndAnchor = new Comment("lentjs end-dynamic-anchor");
    parent.insertBefore(dynamicEndAnchor, anchorElement);
    parent.insertBefore(dynamicStartAnchor, anchorElement);

    let lastResultState = patchElement(parent, dynamicEndAnchor, previousState, newChild);

    const hh = microtaskDebounce(() => {
      [newChild, storeReads] = listenForStoreReads(() => child(newChild));
      lastResultState = patchElement(parent, dynamicEndAnchor, lastResultState, newChild);
    
      currentUnsubscribe = subscribeToStoreReads(hh, storeReads, { once: true });
    });
    let currentUnsubscribe = subscribeToStoreReads(hh, storeReads, { once: true });

    return {
      kind: "dynamic",
      startAnchor: dynamicStartAnchor,
      endAnchor: dynamicEndAnchor,
      element: child,
      unsubscribe: () => {
        currentUnsubscribe();
        dynamicStartAnchor.remove();
        dynamicEndAnchor.remove();
        return lastResultState;
      },
    };
  }
}

/// Specialized function for arrays with no previous state (so we just adds the elements)
function appendArray(parent: Node, anchorElement: ChildNode | null, child: JSXElement[]): JSXStateArray {
  let currentAnchor = anchorElement;
  let states: JSXState[] = [];
  for (let i = child.length-1; i>=0;i--) {
    const state = patchElement(parent, currentAnchor, null, child[i]!);
    states.push(state);
    currentAnchor = getFirstAnchorElement(state) ?? currentAnchor;
  }
  return {
    kind: "array",
    element: child,
    states,
  };
}

// Old naive algorithm for array patching, i think it's broken in this state
// and anyways is very ineficient
// Kept for referance
function patchElementArray(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElement[]): JSXStateArray {
  if (previousState?.kind !== "array") {
    previousState = {
      kind: "array",
      states: previousState === null ? [] : [previousState],
      element: child,
    };
  }

  // let currentAnchor = nextSibling;
  const newState: JSXStateArray = {
    kind: "array",
    states: [],
    element: child,
  };

  let currentAnchor = anchorElement;
  for (let i = Math.max(previousState.states.length, child.length)-1; i >= 0; i--) {
    const outState = patchElement(parent, currentAnchor, previousState.states[i] ?? null, child[i]);
    newState.states.push(outState);
    currentAnchor = getFirstAnchorElement(outState) ?? anchorElement;
  }
  newState.states.reverse();
  return newState;
}

export function patchElementArrayNew(
  parent: Node,
  anchorElement: ChildNode | null,
  previousState_: JSXStateSingular | JSXStateArray,
  child: JSXElement[],
): JSXStateArray {
  throw new Error("todo");
}

export function patchElement(parent: Node, anchorElement: ChildNode | null, previousState: JSXState | null, child: JSXElement): JSXState {
  if (previousState !== null && previousState.element === child) return previousState;

  assert(anchorElement === null || anchorElement.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState?.kind === "dynamic") {
    return patchElement(parent, anchorElement, previousState.unsubscribe(), child);
  }

  if (isFunction(child)) {
    return patchElementDynamic(parent, anchorElement, previousState, child);
  }
  
  if (Array.isArray(child)) {
    if (previousState === null) {
      return appendArray(parent, anchorElement, child);
    }
    else {
      return patchElementArrayNew(parent, anchorElement, previousState, child);
    }
  }
  else {
    child satisfies JSXElementSingular;

    if (previousState === null || previousState.kind === "singular") {
      return patchElementSingular(parent, anchorElement, previousState, child);
    }
    else {
      throw new Error("todo");
    }
  }
}
