import { test, expect, describe, afterEach } from "bun:test";
import { patchElement, removeStateNodes, type JSXState } from "./patch-element";
import { isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, isSSRElement, type JSXElement, type JSXElementSingular } from ".";
import { Scope } from "@lentjs/core-reactivity";
import fc from "fast-check";
import { assert, unreachable } from "@lentjs/utils";

fc.configureGlobal({
  seed: 69,
  numRuns: 200,
  includeErrorInReport: true,
  skipEqualValues: true,
});

const nodeIds = new Map<unknown, number>;

type SimplifiedDom =
  | { kind: "text", content: string, id?: number }
  | { kind: "comment", content: string, id?: number }
  | { kind: "element", tag: string, attributes: [string, string][], children: SimplifiedDom[], id?: number }
;
function simplifyDom(n: HTMLElement, enableId?: boolean): SimplifiedDom & { kind: "element" };
function simplifyDom(n: Node, enableId?: boolean): SimplifiedDom;
function simplifyDom(n: Node, enableId: boolean = true): SimplifiedDom {
  const idText = nodeIds.has(n) ? nodeIds.get(n)! : (nodeIds.set(n, nodeIds.size), nodeIds.size-1);
  const id = enableId ? { id: idText } : {};
  if (n instanceof Text) {
    return {
      kind: "text",
      content: n.textContent,
      ...id,
    };
  }

  if (n instanceof Comment) {
    return {
      kind: "comment",
      content: n.textContent,
      ...id,
    };
  }

  if (n instanceof HTMLElement) {
    return {
      kind: "element",
      tag: n.tagName,
      attributes: [...n.attributes].map(a => [a.name, a.value]),
      children: [...n.childNodes].map(p => simplifyDom(p, enableId)),
      ...id,
    };
  }

  throw new Error("unsuported node");
}

function expectedString(el: JSXElement): string {
  if (el === null || el === undefined)
    return "";
  if (isJSXElementString(el))
    return el.toString();
  if (isJSXElementDynamic(el))
    return expectedString(el());
  if (isJSXElementWithScope(el))
    return expectedString(el.fun());
  if (isSSRElement(el))
    return el.build();
  if (Array.isArray(el))
    return el.map(expectedString).join("");
  if (el instanceof Node)
    return el.textContent ?? "";
  unreachable(el);
}

function expectedSimplifiedDom(el: JSXElement): SimplifiedDom[] {
  if (el === null || el === undefined)
    return [];
  if (isJSXElementString(el))
    return [{ kind: "text", content: el.toString() }];
  if (isJSXElementDynamic(el))
    return expectedSimplifiedDom(el());
  if (isJSXElementWithScope(el))
    return expectedSimplifiedDom(el.withScope.enter(el.fun));
  if (isSSRElement(el))
    assert(false, "todo");
  if (Array.isArray(el))
    return el.flatMap(expectedSimplifiedDom);
  if (el instanceof Node)
    return [simplifyDom(el)];
  unreachable(el);
}

function fullReset() {
  document.body.innerHTML = "";
  nodeIds.clear();
}

const { arbitraryJSXElement } = fc.letrec<{
  arbitraryJSXElementSingular: JSXElementSingular,
  arbitraryJSXElement: JSXElement,
}>(rec => ({
  arbitraryJSXElementSingular: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.string(),
    fc.float(),
    fc.maxSafeInteger(),
  ),
  arbitraryJSXElement: fc.oneof(
    { weight: 7, arbitrary: rec("arbitraryJSXElementSingular") },
    { weight: 3, arbitrary: fc.array(rec("arbitraryJSXElement")), },
    { weight: 2, arbitrary: fc.func(rec("arbitraryJSXElement")), },
  ),
}));

const jsxElementExamples: JSXElement[] = [
  -0, 0,
  Infinity, NaN,
  "", "0",
];

afterEach(() => {
  fullReset();
});

describe("Property based testig, patchElement called", () => {
  const examples = jsxElementExamples.map<[JSXElement]>(p => [p]);

  test("once, snapshoting dom state", () => {
    fc.assert(fc.property(arbitraryJSXElement, (val) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        patchElement(container, null, null, val);
        expect({
          val,
          dom: simplifyDom(container),
        }).toMatchSnapshot();
      });
      cleanup();
      fullReset();
    }), { examples, numRuns: 20 });
  });

  test("twice with same value, should not change anything", () => {
    fc.assert(fc.property(arbitraryJSXElement, (val) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        const state1 = patchElement(container, null, null, val);
        const beforeDom = simplifyDom(container);
        const beforeTxt = container.innerText;
        patchElement(container, null, state1, val);
        expect(simplifyDom(container)).toEqual(beforeDom);
        expect(container.innerText).toEqual(beforeTxt);
      });
      cleanup();
      fullReset();
    }), { examples });
  });

  test("twice with equivalent value, should not change anything (but may re-create elements)", () => {
    fc.assert(fc.property(fc.clone(arbitraryJSXElement, 2), ([val1, val2]) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        const state1 = patchElement(container, null, null, val1);
        const beforeDom = simplifyDom(container,false);
        const beforeTxt = container.innerText;
        patchElement(container, null, state1, val2);
        expect(simplifyDom(container,false)).toEqual(beforeDom);
        expect(container.innerText).toEqual(beforeTxt);
      });
      cleanup();
      fullReset();
    }), { examples: examples.map(([p]) => [[p, p]]) });
  });

  test("n times changing the value, asserting finished innerText", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), (vals) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        let state: JSXState | null = null;
        vals.map(val => {
          state = patchElement(container, null, state, val);
        });
        expect(container.innerText).toEqual(expectedString(vals.at(-1)));
      });
      cleanup();
      fullReset();
    }));
  });

  test("n times changing the value, asserting finished dom", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), (vals) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        let state: JSXState | null = null;
        vals.map(val => {
          state = patchElement(container, null, state, val);
        });
        expect(simplifyDom(container, false).children).toEqual(expectedSimplifiedDom(vals.at(-1)));
      });
      cleanup();
      fullReset();
    }));
  });

  test("n times changing the value, than calling removeStateNodes, asserting empty body", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), (vals) => {
      fullReset();
      const container = document.createElement("div");
      const [scope, cleanup] = Scope.createControlled();
      scope.enter(() => {
        let state: JSXState | null = null;
        vals.map(val => {
          state = patchElement(container, null, state, val);
        });
        removeStateNodes(state!);
        expect(container.innerHTML).toEqual("");
      });
      cleanup();
      fullReset();
    }));
  });
});
