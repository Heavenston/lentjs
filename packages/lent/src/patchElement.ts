import { isJSXElementString, isSSRElement, type JSXElement, type JSXElementArray, type JSXElementDynamic, type JSXElementSingular } from ".";
import { listenForStoreReads, subscribeToStoreReads } from "./store";
import { assert, isFunction, microtaskDebounce } from "./utils";

export type JSXStateCommon = { kind: string, element: JSXElement };
export type JSXStateSingular = JSXStateCommon & { kind: "singular", element: JSXElementSingular, node: ChildNode | null };
export type JSXStateDynamic = JSXStateCommon & { kind: "dynamic", startAnchor: ChildNode, endAnchor: ChildNode, element: JSXElementDynamic, unsubscribe: () => JSXState };
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

export function patchElementSingular(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | null, child: JSXElementSingular): JSXStateSingular {
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

export function patchElementArray(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElement[]): JSXStateArray {
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

// export function patchElementArrayNew(parent: Node, anchorElement: ChildNode | null, previousState: JSXStateSingular | JSXStateArray | null, child: JSXElement[]): JSXStateArray {
//   if (previousState?.kind !== "array") {
//     previousState = {
//       kind: "array",
//       element: child,
//       states: previousState === null ? [] : [previousState],
//     };
//   }

//   type Operation =
//     | { kind: "add", element: number, anchor: number | ChildNode | null }
//     | { kind: "remove", element: JSXElement, anchor: number | ChildNode | null }
//   ;
//   const operations = new Array<Operation>();

//   function anchorToJSXElement(val: number | ChildNode | null): JSXElement {
//     return typeof val === "number"
//       ? child[val]
//       : val;
//   }
//   function compareAnchor(a: number | ChildNode | null, b: number | ChildNode | null): boolean {
//     if (typeof a === "number" && typeof b === "number")
//       return a === b;
//     return compareEl(anchorToJSXElement(a), anchorToJSXElement(b));
//   }
//   function compareEl(a: JSXElement, b: JSXElement) {
//     if (a === b)
//       return true;
//     if (typeof a === "string" || typeof a === "number") {
//       if (b instanceof Text)
//         return true;
//       else
//         return false;
//     }
//     if (typeof b === "string" || typeof b === "number") {
//       if (a instanceof Text)
//         return a.textContent === b.toString();
//       else
//         return false;
//     }
//     return false;
//   }

//   const size = Math.max(previousState.states.length, child.length);
//   let currentRemoveAnchor: ChildNode | null = null;
//   let currentInsertAnchor: number | null = null;
//   for (let index = size-1; index >= 0; index--) {
//     if (index < previousState.states.length) {
//       operations.push({ kind: "remove", element: previousState.states[index]!.element, anchor: currentRemoveAnchor })
//       currentRemoveAnchor = getFirstAnchorElement(previousState.states[index]!);
//     }
//     if (index < child.length) {
//       operations.push({ kind: "add", element: index, anchor: currentInsertAnchor })
//       currentInsertAnchor = index;
//     }
//   }

//   for (let i = 0; i < operations.length; i++) {
//     const op1 = operations[i]!;
//     for (let j = i+1; j < operations.length; j++) {
//       const op2 = operations[j]!;
//       if (op1.kind === "add" && compareAnchor(op2.anchor, op1.anchor)) {
//         op2.anchor = op1.element;
//       }
//       else if (op1.kind === "remove" && compareEl(anchorToJSXElement(op2.anchor), op1.element)) {
//         op2.anchor = op1.anchor;
//       }
//     }
//   }

//   for (let i = 0; i < operations.length; i++) {
//     const op1 = operations[i]!;
//     for (let j = i+1; j < operations.length; j++) {
//       const op2 = operations[j]!;
//       if (op1.kind === "remove" && op2.kind === "add" && op1.anchor === op2.anchor && compareEl(op1.element, child[op2.element])) {
//         for (let k = i+1; k < j; k++) {
//           if (compareAnchor(operations[k]!.anchor, op1.anchor)) {
//             operations[k]!.anchor = op2.element;
//           }
//         }
//         operations.splice(j, 1);
//         operations.splice(i, 1);
//         i--;
//         break;
//       }
//     }
//   }

//   const childToNode = new Map<number, ChildNode>;
//   for (const op of operations) {
//     switch (op.kind) {
//     case "add":
//       break;
//     case "remove":
//       break;
//     }
//   }

//   console.log("step3:",operations);

//   throw new Error();
// }

export function patchElement(parent: Node, anchorElement: ChildNode | null, previousState: JSXState | null, child: JSXElement): JSXState {
  if (previousState !== null && previousState.element === child) return previousState;

  assert(anchorElement === null || anchorElement.parentNode === parent);
  assert(!isSSRElement(child));

  if (previousState?.kind === "dynamic") {
    return patchElement(parent, anchorElement, previousState.unsubscribe(), child);
  }

  if (isFunction(child)) {
    const dynamicStartAnchor = new Comment("lentjs start-anchor");
    const dynamicEndAnchor = new Comment("lentjs end-anchor");
    parent.insertBefore(dynamicEndAnchor, anchorElement);
    parent.insertBefore(dynamicStartAnchor, anchorElement);

    let [newChild, storeReads] = listenForStoreReads(() => child());
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
  
  if (Array.isArray(child)) {
    return patchElementArray(parent, anchorElement, previousState, child);
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
