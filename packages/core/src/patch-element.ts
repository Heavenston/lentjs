import { isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, isSSRElement, type JSXElement, type JSXElementArray, type JSXElementDynamic, type JSXElementSingular, type JSXElementWithScope } from ".";
import { assert, unreachable } from "@lentjs/utils";
import { isInTrackingContext, untrack, getScope, startReaction, resumeReaction } from "@lentjs/core-reactivity";
import { isChildrenArray } from "./children-array";

export type JSXStateCommon = { kind: string, element: JSXElement };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", element: JSXElementSingular, node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & {
  kind: "dynamic",
  startAnchor: ChildNode | null,
  endAnchor: ChildNode | null,
  element: JSXElementDynamic,
  changeAnchor(newAnchor: ChildNode | null): void,
  cleanup(): void;
  remove(): void,
};
export type JSXStateWithScope = JSXStateCommon & { kind: "withScope", element: JSXElementWithScope, resultState: JSXState };
export type JSXStateArray = JSXStateCommon & { kind: "array", element: JSXElementArray, states: JSXState[] }
export type JSXState = JSXStateSingular | JSXStateArray | JSXStateWithScope | JSXStateDynamic;

export function getFirstElement(state: JSXState): ChildNode | null {
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
  case "withScope":
    return getFirstElement(state.resultState);
  case "dynamic":
    return state.startAnchor;
  }
}

export function getLastElement(state: JSXState): ChildNode | null {
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
  case "withScope":
    return getLastElement(state.resultState);
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

export function changeStateAnchor(parent: Node, state: JSXState, newAnchor: ChildNode | null): void {
  switch (state.kind) {
  case "array": {
    let currentAnchor = newAnchor;
    for (let i = state.states.length-1; i>=0; i--) {
      changeStateAnchor(parent, state.states[i]!, currentAnchor);
      currentAnchor = getFirstElement(state.states[i]!) ?? currentAnchor;
    }
    break;
  }
  case "singular":
    if (state.node !== null)
      parent.insertBefore(state.node, newAnchor);
    break;
  case "withScope":
    changeStateAnchor(parent, state.resultState, newAnchor);
    break;
  case "dynamic":
    state.changeAnchor(newAnchor);
    break;
  default:
    unreachable(state);
  }
}

export function removeStateNodes(state: JSXState): void {
  switch (state.kind) {
  case "singular":
    state.node?.remove();
    break;
  case "array":
    state.states.forEach(removeStateNodes);
    break;
  case "withScope":
    removeStateNodes(state.resultState);
    break;
  case "dynamic":
    state.remove();
    break;
  default:
    unreachable(state);
  }
}

export function cleanupStateNodes(state: JSXState): void {
  switch (state.kind) {
  case "singular": break;
  case "array":
    state.states.forEach(cleanupStateNodes);
    break;
  case "withScope":
    cleanupStateNodes(state.resultState);
    break;
  case "dynamic":
    state.cleanup();
    break;
  default:
    unreachable(state);
  }
}

function patchElementSingular(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | null, child: JSXElementSingular): JSXStateSingular {
  assert(anchorElement === null || anchorElement.parentNode === parent, "Invalid end anchor");
  assert(previousState?.node == null || previousState.node.parentNode === parent, "Invalid node");
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
  const scope = getScope();

  const [firstChildReturn, initialCapturedReactivity] = startReaction(() => scope.enter(() => child()));

  if (initialCapturedReactivity.length === 0) {
    const state = patchElement(parent, anchorElement, null, firstChildReturn);
    return {
      kind: "dynamic",
      startAnchor: getFirstElement(state),
      endAnchor: getLastElement(state),
      element: child,
      cleanup() {
        cleanupStateNodes(state);
      },
      remove() {
        this.cleanup();
        removeStateNodes(state);
      },
      changeAnchor(newAnchor) {
        changeStateAnchor(parent, state,newAnchor);
      },
    };
  }

  const dynamicStartAnchor = new Comment("runtime-dyn-start");
  const dynamicEndAnchor = new Comment("runtime-dyn-end");
  parent.insertBefore(dynamicStartAnchor, anchorElement);
  parent.insertBefore(dynamicEndAnchor, anchorElement);

  let previousChildReturn = firstChildReturn;
  let previousResultState: JSXState | null = null;

  scope.enter(() => {
    previousResultState = patchElement(parent, dynamicEndAnchor, previousResultState, firstChildReturn);
  });

  const unsub = resumeReaction(() => scope.enter(() => {
    previousChildReturn = child(previousChildReturn);
    untrack(() => {
      previousResultState = patchElement(parent, dynamicEndAnchor, previousResultState, previousChildReturn);
    });
  }), initialCapturedReactivity);

  return {
    kind: "dynamic",
    startAnchor: dynamicStartAnchor,
    endAnchor: dynamicEndAnchor,
    element: child,
    cleanup() {
      unsub();
      cleanupStateNodes(previousResultState!);
    },
    remove() {
      this.cleanup();
      dynamicStartAnchor.remove();
      dynamicEndAnchor.remove();
      removeStateNodes(previousResultState!);
    },
    changeAnchor(newAnchor) {
      parent.insertBefore(dynamicStartAnchor, newAnchor);
      parent.insertBefore(dynamicEndAnchor, newAnchor);
      changeStateAnchor(parent, previousResultState!, dynamicEndAnchor);
    },
  };
}

/// Specialized function for arrays with no previous state (so we just adds the elements)
function appendArray(parent: Node, anchorElement: ChildNode | null, child: JSXElement[]): JSXStateArray {
  let currentAnchor = anchorElement;
  const states: JSXState[] = [];
  for (let i = child.length-1; i>=0;i--) {
    const childEl = isChildrenArray(child) ? child.getOrComputed(i) : child[i];
    const state = patchElement(parent, currentAnchor, null, childEl);
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

function patchElementArray(
  parent: Node,
  anchorElement: ChildNode | null,
  previousState: JSXStateArray,
  child: JSXElement[],
): JSXStateArray {
  const toKeepMap = new Map<JSXElement, JSXState[]>;
  for (const old of previousState.states) {
    if (old.element == null) { continue; }
    if (!toKeepMap.has(old.element))
      toKeepMap.set(old.element, []);
    toKeepMap.get(old.element)!.push(old);
  }

  const states = Array<JSXState>();
  let currentAnchor = anchorElement;
  for (let i = child.length-1; i>=0; i--) {
    const childEl = isChildrenArray(child) ? child.getOrComputed(i) : child[i];

    const prev = toKeepMap.get(childEl)?.pop();
    const newState = patchElement(parent, currentAnchor, prev ?? null, childEl);
    currentAnchor = getFirstElement(newState) ?? currentAnchor;
    states.push(newState);
  }
  states.reverse();

  for (const oldA of toKeepMap.values()) {
    for (const old of oldA)
      removeStateNodes(old);
  }
  
  return {
    kind: "array",
    element: child,
    states,
  };
}

export function patchElement(parent: Node, anchorElement: ChildNode | null, previousState: JSXState | null, child: JSXElement): JSXState {
  assert(!isInTrackingContext(), "You should not call patchElement within a tracking context, wrap in untrack()");

  assert(anchorElement === null || anchorElement.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState !== null && Object.is(previousState.element, child)) {
    if (!stateIsAnchoredTo(previousState, anchorElement))
      changeStateAnchor(parent, previousState, anchorElement);
    return previousState;
  }

  if (Array.isArray(child)) {
    if (previousState?.kind !== "array") {
      if (previousState) removeStateNodes(previousState);
      return appendArray(parent, anchorElement, child);
    }
    return patchElementArray(parent, anchorElement, previousState, child);
  }

  if (isJSXElementDynamic(child)) {
    if (previousState) removeStateNodes(previousState);
    return patchElementDynamic(parent, anchorElement, child);
  }

  if (isJSXElementWithScope(child)) {
    if (previousState) removeStateNodes(previousState);
    return child.withScope.enter((): JSXStateWithScope => {
      const el = child.fun();
      const resultState = patchElement(parent, anchorElement, null, el);
      return {
        kind: "withScope",
        element: child,
        resultState,
      };
    });
  }
  
  child satisfies JSXElementSingular;
  if (previousState?.kind !== "singular") {
    if (previousState) removeStateNodes(previousState);
    previousState = null;
  }
  return patchElementSingular(parent, anchorElement, previousState, child);
}
