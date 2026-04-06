import { isJSXElementString, isSSRElement, type JSXElement, type JSXElementArray, type JSXElementDynamic, type JSXElementSingular } from ".";
import { assert, isFunction } from "./utils";
import { createOwner, createTask, enterOwner, getOwner } from "@lentjs/core-reactivity";

export type JSXStateCommon = { kind: string, element: JSXElement };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", element: JSXElementSingular, node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & { kind: "dynamic", startAnchor: ChildNode | null, endAnchor: ChildNode | null, element: JSXElementDynamic, changeAnchor: (newAnchor: ChildNode | null) => void, cleanup: () => JSXState };
export type JSXStateArray = JSXStateCommon & { kind: "array", element: JSXElementArray, states: JSXState[] }
export type JSXState = JSXStateSingular | JSXStateArray | JSXStateDynamic;

function getFirstElement(state: JSXState): ChildNode | null {
  switch (state.kind) {
  case "singular":
    return state.node;
  case "array":
    for (const s of state.states) {
      const potentialAnchor = getFirstElement(s);
      if (potentialAnchor !== null)
        return potentialAnchor;
    }
    return null;
  case "dynamic":
    return state.startAnchor;
  }
}

function getLastElement(state: JSXState): ChildNode | null {
  switch (state.kind) {
  case "singular":
    return state.node;
  case "array":
    for (let i = state.states.length-1; i>=0; i--) {
      const potentialAnchor = getLastElement(state.states[i]!);
      if (potentialAnchor !== null)
        return potentialAnchor;
    }
    return null;
  case "dynamic":
    return state.endAnchor;
  }
}

/// Returns true if the given state's last node has the given anchor as a nextSibling
/// So is used to know whether a state would need to be moved to match the given anchor
function stateIsAnchoredTo(state: JSXState, anchor: ChildNode | null): boolean {
  const lastEl = getLastElement(state);
  return lastEl === null || lastEl.nextSibling === anchor;
}

export function changeStateAnchor(parent: Node, state: JSXState, newAnchor: ChildNode | null) {
  console.log("Moving", state, "to", newAnchor);
  switch (state.kind) {
  case "array":
    let currentAnchor = newAnchor;
    for (let i = state.states.length-1; i>=0; i--) {
      changeStateAnchor(parent, state.states[i]!, currentAnchor);
      currentAnchor = getFirstElement(state.states[i]!) ?? currentAnchor;
    }
    break;
  case "singular":
    if (state.node !== null)
      parent.insertBefore(state.node, newAnchor);
    break;
  case "dynamic":
    state.changeAnchor(newAnchor);
    break;
  }
}

export function removeStateNodes(state: JSXState) {
  switch (state.kind) {
  case "singular":
    state.node?.remove();
    break;
  case "array":
    state.states.forEach(removeStateNodes);
    break;
  case "dynamic":
    removeStateNodes(state.cleanup());
    break;
  }
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
      if (childAsNode.nextSibling !== anchorElement)
        parent.insertBefore(childAsNode, anchorElement);
    }
    else {
      parent.replaceChild(childAsNode, previousState.node);
    }
    return { kind: "singular", element: child, node: childAsNode };
  }
}

function patchElementDynamic(parent: Node, anchorElement: ChildNode | null, child: JSXElementDynamic): JSXStateDynamic {
  const parentOwner = getOwner();
  const [owner, cleanupOwner] = createOwner(parentOwner);

  const dynamicStartAnchor = new Comment("runtime-dyn-start");
  const dynamicEndAnchor = new Comment("runtime-dyn-end");
  parent.insertBefore(dynamicStartAnchor, anchorElement);
  parent.insertBefore(dynamicEndAnchor, anchorElement);

  let lastResultState: JSXState | null = null;
  enterOwner(owner, () => createTask(() => {
    lastResultState = patchElement(parent, dynamicEndAnchor, lastResultState, child(lastResultState?.element));
  }));

  return {
    kind: "dynamic",
    startAnchor: dynamicStartAnchor,
    endAnchor: dynamicEndAnchor,
    element: child,
    cleanup: () => {
      cleanupOwner();
      dynamicStartAnchor.remove();
      dynamicEndAnchor.remove();
      return lastResultState!;
    },
    changeAnchor(newAnchor) {
      parent.insertBefore(dynamicStartAnchor, newAnchor);
      parent.insertBefore(dynamicEndAnchor, newAnchor);
      changeStateAnchor(parent, lastResultState!, dynamicEndAnchor);
    },
  };
}

/// Specialized function for arrays with no previous state (so we just adds the elements)
function appendArray(parent: Node, anchorElement: ChildNode | null, child: JSXElement[]): JSXStateArray {
  let currentAnchor = anchorElement;
  let states: JSXState[] = [];
  for (let i = child.length-1; i>=0;i--) {
    const state = patchElement(parent, currentAnchor, null, child[i]!);
    states.push(state);
    currentAnchor = getFirstElement(state) ?? currentAnchor;
  }
  states.reverse();
  return {
    kind: "array",
    element: child,
    states,
  };
}

export function patchElementArrayNew(
  parent: Node,
  anchorElement: ChildNode | null,
  previousState: JSXStateArray,
  child: JSXElement[],
): JSXStateArray {
  const toKeepMap = new Map<JSXElement, JSXState>;
  for (const old of previousState.states) {
    if (old.element == null) { continue; }
    toKeepMap.set(old.element, old);
  }

  const states = Array<JSXState>();
  let currentAnchor = anchorElement;
  for (let i = child.length-1; i>=0; i--) {
    const prev = toKeepMap.get(child[i]);
    toKeepMap.delete(child[i]);
    const newState = patchElement(parent, currentAnchor, prev ?? null, child[i]);
    currentAnchor = getFirstElement(newState) ?? currentAnchor;
    states.push(newState);
  }
  states.reverse();

  for (const old of toKeepMap.values()) {
    removeStateNodes(old);
  }
  
  return {
    kind: "array",
    element: child,
    states,
  };
}

export function patchElement(parent: Node, anchorElement: ChildNode | null, previousState: JSXState | null, child: JSXElement): JSXState {
  if (previousState !== null && previousState.element === child && stateIsAnchoredTo(previousState, anchorElement)) return previousState;

  assert(anchorElement === null || anchorElement.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState?.kind === "dynamic" && previousState.element === child) {
    return previousState;
  }
  if (previousState?.kind === "dynamic") {
    return patchElement(parent, anchorElement, previousState.cleanup(), child);
  }

  if (isFunction(child)) {
    if (previousState)
      removeStateNodes(previousState);
    return patchElementDynamic(parent, anchorElement, child);
  }
  
  if (Array.isArray(child)) {
    if (previousState?.kind !== "array") {
      if (previousState)
        removeStateNodes(previousState);
      return appendArray(parent, anchorElement, child);
    }
    return patchElementArrayNew(parent, anchorElement, previousState, child);
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
