import { test, expect, describe, afterEach } from "bun:test";
import { patchElement, removeStateNodes, type JSXState } from "./patch-element";
import { isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, isSSRElement, type JSXElement, type JSXElementSingular, type JSXElementString } from ".";
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

export type SimplifiedDom =
  | { kind: "text", content: string, id?: number }
  | { kind: "comment", content: string, id?: number }
  | { kind: "element", tag: string, attributes: [string, string][], children: SimplifiedDom[], id?: number }
;
export function simplifyDom(n: HTMLElement, enableId?: boolean): SimplifiedDom & { kind: "element" };
export function simplifyDom(n: Node, enableId?: boolean): SimplifiedDom;
export function simplifyDom(n: Node, enableId: boolean = true): SimplifiedDom {
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

export function expectedString(el: JSXElement): string {
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

export function expectedSimplifiedDom(el: JSXElement): SimplifiedDom[] {
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
    return [simplifyDom(el, false)];
  unreachable(el);
}

function fullReset() {
  document.body.innerHTML = "";
  nodeIds.clear();
}

const { arbitraryJSXElement } = fc.letrec<{
  arbitraryJSXElementString: JSXElementString,
  arbitraryJSXElementSingular: JSXElementSingular,
  arbitraryJSXElement: JSXElement,
}>(rec => ({
  arbitraryJSXElementString: fc.oneof(
    { withCrossShrink: true },
    fc.constantFrom("", "non empty string"),
    fc.constantFrom(0,-0,Number.NaN,Number.NEGATIVE_INFINITY,Number.POSITIVE_INFINITY,Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),
  ),
  arbitraryJSXElementSingular: fc.oneof(
    { withCrossShrink: true },
    rec("arbitraryJSXElementString"),
    fc.constantFrom(null, undefined),
    fc.constant("div").map(name => document.createElement(name)),
    rec("arbitraryJSXElementString").map(t => document.createTextNode(t.toString())),
  ),
  arbitraryJSXElement: fc.oneof(
    { withCrossShrink: true, depthSize: "xsmall", depthIdentifier: "id:arbitraryJSXElement" },
    rec("arbitraryJSXElementString"),
    fc.array(rec("arbitraryJSXElementSingular"), { size: "small", depthIdentifier: "id:arbitraryJSXElement" }),
    rec("arbitraryJSXElement").map(e => {
      const f = () => e;
      f.toString = () => `(() => ${fc.stringify(e)})`;
      return f;
    }),
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

function testWrapper(fn: (container: HTMLElement) => void) {
  fullReset();
  const container = document.createElement("div");
  const [scope, cleanup] = Scope.createControlled();
  scope.enter(() => {
    fn(container);
  });
  cleanup();
  fullReset();
}

describe("Property based testig, patchElement called", () => {
  const examples = jsxElementExamples.map<[JSXElement]>(p => [p]);

  test("twice with same value, should not change anything", () => {;
    fc.assert(fc.property(arbitraryJSXElement, val => testWrapper(container => {
      const state1 = patchElement(container, null, null, val);
      const beforeDom = simplifyDom(container);
      const beforeTxt = container.innerText;
      patchElement(container, null, state1, val);
      expect(simplifyDom(container)).toEqual(beforeDom);
      expect(container.innerText).toEqual(beforeTxt);
    })), { examples });
  });

  test("twice with equivalent value, should not change anything (but may re-create elements)", () => {
    fc.assert(fc.property(fc.clone(arbitraryJSXElement, 2), ([val1, val2]) => testWrapper(container => {
      const state1 = patchElement(container, null, null, val1);
      const beforeDom = simplifyDom(container,false);
      const beforeTxt = container.innerText;
      patchElement(container, null, state1, val2);
      expect(simplifyDom(container,false)).toEqual(beforeDom);
      expect(container.innerText).toEqual(beforeTxt);
    })), { examples: examples.map(([p]) => [[p, p]]) });
  });

  test("n times snapshoting dom state", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1, maxLength: 3 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      expect(simplifyDom(container)).toMatchSnapshot();
    })), { numRuns: 20 });
  });

  test("n times changing the value, asserting finished innerText", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      expect(container.innerText).toEqual(expectedString(vals.at(-1)));
    })));
  });

  test("n times changing the value, asserting finished dom", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      expect(simplifyDom(container, false).children).toEqual(expectedSimplifiedDom(vals.at(-1)));
    })), {
      examples: [
        ...jsxElementExamples.map<[[JSXElement]]>((p) => [[p]]),
        ...jsxElementExamples.flatMap(a => (
          jsxElementExamples.map<[[JSXElement, JSXElement]]>(b => (
            [[a, b]]
          ))
        )),
      ],
    });
  });

  test("n times changing the value, than calling removeStateNodes, asserting empty body", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement, { minLength: 1 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      removeStateNodes(state!);
      expect(container.innerHTML).toEqual("");
    })), {
      examples: [
        ...jsxElementExamples.map<[[JSXElement]]>((p) => [[p]]),
        ...jsxElementExamples.flatMap(a => (
          jsxElementExamples.map<[[JSXElement, JSXElement]]>(b => (
            [[a, b]]
          ))
        )),
      ],
    });
  });
});

test("patchElement should do nothing if the array instance is the same", () => testWrapper(container => {
  const array: JSXElement[] = ["1", 2, 3];
  const state = patchElement(container, null, null, array);
  const prevDom = simplifyDom(container);
  array.push("4");
  patchElement(container, null, state, array);
  expect(simplifyDom(container)).toEqual(prevDom);
  expect(container.innerText).toMatchInlineSnapshot(`"123"`);
}));

test("patchElement should keep text nodes and just change content if possible", () => testWrapper(container => {
  const state = patchElement(container, null, null, "first value");
  const c = container.firstChild!;
  patchElement(container, null, state, "second value");
  expect(Object.is(container.firstChild, c)).toBeTrue();
  expect(container.firstChild?.textContent).toBe("second value");
}));
