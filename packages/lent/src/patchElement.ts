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

// FIXME: This was supposed to be a stepping stone for an efficient algorithm
// but i lost interest in this so we are stuck with this one
export function patchElementArrayNew(parent: Node, anchorElement: ChildNode | null, previousState_: JSXStateSingular | JSXStateArray, child: JSXElement[]): JSXStateArray {
  const previousState: JSXStateArray = previousState_.kind !== "array"
    ? { kind: "array", element: child, states: [previousState_] }
    : previousState_;

  type AddOperation = { kind: "add", element: number, anchor: number | null };
  type RemoveOperation = { kind: "remove", useless?: true, element: JSXElement, state: JSXState, anchor: ChildNode | null };
  type Operation = AddOperation | RemoveOperation;
  const addOperations = Array<AddOperation>();
  const removeOperations = Array<RemoveOperation>();

  function anchorToJSXElement(val: number | ChildNode | null): JSXElement {
    return typeof val === "number"
      ? child[val]
      : val;
  }
  function compareAnchor(a: number | ChildNode | null, b: number | ChildNode | null): boolean {
    if (a === null && b === null)
      return true;
    if (typeof a === "number" && typeof b === "number")
      return a === b;
    return compareEl(anchorToJSXElement(a), anchorToJSXElement(b));
  }

  function logOp(op: Operation) {
    switch (op.kind) {
    case "add":
      console.log("add", op.element, child[op.element], "anchor", op.anchor, anchorToJSXElement(op.anchor));
      break;
    case "remove":
      console.log("sub", op.element, "anchor", anchorToJSXElement(op.anchor), op.useless ? "is useless" : " ");
      break;
    }
  }
  function logOperations() {
    console.log("------");
    removeOperations.forEach(logOp);
    addOperations.forEach(logOp);
  }

  // console.log("#".repeat(200));

  let currentRemoveAnchor: ChildNode | null = null;
  for (let i = previousState.states.length-1; i>=0; i--) {
    const state = previousState.states[i]!;
    removeOperations.push({ kind: "remove", state, element: state.element, anchor: currentRemoveAnchor })
    currentRemoveAnchor = getFirstAnchorElement(state);
  }
  let currentInsertAnchor: number | null = null;
  for (let i = child.length-1; i>=0; i--) {
    addOperations.push({ kind: "add", element: i, anchor: currentInsertAnchor })
    currentInsertAnchor = i;
  }

  // console.log("STEP1");
  // logOperations();
  const childsAsAnchors = new Map<number, ChildNode | null>;
  const newStates: (JSXState | null)[] = child.map(() => null);

  for (let i = 0; i < removeOperations.length; i++) {
    const op1 = removeOperations[i]!;
    // console.log("--------------");
    // console.log("Going through:");
    // logOp(op1);
    let anchor: number | ChildNode | null = op1.anchor;
    // console.log(":", anchor);

    for (let j = i+1; j < removeOperations.length; j++) {
      const op2 = removeOperations[j]!;
      // logOp(op2);
      if (compareEl(anchorToJSXElement(anchor), op2.element)) {
        anchor = op2.anchor;
        // console.log("new anchor(rem):", anchor);
      }
    }
    for (let j = 0; j < addOperations.length; j++) {
      const op2 = addOperations[j]!;
      // logOp(op2);
      if (compareEl(child[op2.element], op1.element)) {
        if (compareAnchor(op2.anchor, anchor)) {
          // console.log("Add remove with same anchor -> removing");
          childsAsAnchors.set(op2.element, getFirstAnchorElement(op1.state));
          newStates[op2.element] = op1.state;

          removeOperations.splice(i, 1);
          addOperations.splice(j, 1);
          i--;
        }
        else {
          // console.log("Add remove different anchor -> useless remove")
          op1.useless = true;
        }
        break;
      }
      if (compareAnchor(anchor, op2.anchor)) {
        anchor = op2.element;
        // console.log("new anchor(add):", anchor, "->", anchorToJSXElement(anchor));
      }
    }
  }

  let currentChildAnchor: ChildNode | null = null;
  for (let i = child.length-1; i >= 0; i--) {
    const anchor = childsAsAnchors.get(i) ?? null;
    currentChildAnchor = anchor ?? currentChildAnchor;
    childsAsAnchors.set(i, anchor);
  }

  // console.log("STEP2");
  // logOperations();
  // debugger;

  for (const op of removeOperations) {
    if (!op.useless)
      removeStateNodes(op.state);
  }
  for (const op of addOperations) {
    let anchor: ChildNode | null;
    if (typeof op.anchor === "number") {
      assert(childsAsAnchors.has(op.anchor));
      anchor = childsAsAnchors.get(op.anchor)!;
    }
    else {
      anchor = op.anchor;
    }
    const ns = patchElement(parent, anchor ?? anchorElement, null, child[op.element]);
    newStates[op.element] = ns;
    childsAsAnchors.set(op.element, getFirstAnchorElement(ns) ?? anchor);
  }

  // console.log("final:", newStates);
  assert(newStates.every(p => p !== null));

  return {
    kind: "array",
    element: child,
    states: newStates as any,
  };
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
