import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { patchElement, removeStateNodes, type JSXState } from "./patch-element";
import type { JSXElement } from ".";
import { createSignal, Scope } from "@lentjs/core-reactivity";
import fc from "fast-check";
import { expectedSimplifiedDom, expectedString, simplifyDom, arbitraryJSXElement } from "./dom-test-utils";
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const jsxElementExamples: JSXElement[] = [
  -0, 0,
  Infinity, NaN,
  "", "0",
];

function testWrapper(fn: (container: HTMLElement) => void) {
  const container = document.createElement("div");
  const [scope, cleanup] = Scope.createControlled();
  scope.enter(() => {
    fn(container);
  });
  cleanup();
}

beforeAll(() => {
  GlobalRegistrator.register();
})

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

describe("Property based testig, patchElement called", () => {
  const examples = jsxElementExamples.map<[JSXElement]>(p => [p]);

  test("twice with same value, should not change anything", () => {;
    fc.assert(fc.property(arbitraryJSXElement(), val => testWrapper(container => {
      const state1 = patchElement(container, null, null, val);
      const beforeDom = simplifyDom(container);
      const beforeTxt = container.innerText;
      patchElement(container, null, state1, val);
      expect(simplifyDom(container)).toEqual(beforeDom);
      expect(container.innerText).toEqual(beforeTxt);
    })), { examples });
  });

  test("twice with equivalent value, should not change anything (but may re-create elements)", () => {
    fc.assert(fc.property(fc.clone(arbitraryJSXElement(), 2), ([val1, val2]) => testWrapper(container => {
      const state1 = patchElement(container, null, null, val1);
      const beforeDom = simplifyDom(container,false);
      const beforeTxt = container.innerText;
      patchElement(container, null, state1, val2);
      expect(simplifyDom(container,false)).toEqual(beforeDom);
      expect(container.innerText).toEqual(beforeTxt);
    })), { examples: examples.map(([p]) => [[p, p]]) });
  });

  test("n times snapshoting dom state", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement(), { minLength: 1, maxLength: 3 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      expect(simplifyDom(container)).toMatchSnapshot();
    })), { numRuns: 20 });
  });

  test("n times changing the value, asserting finished innerText", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement(), { minLength: 1 }), vals => testWrapper(container => {
      let state: JSXState | null = null;
      vals.map(val => {
        state = patchElement(container, null, state, val);
      });
      expect(container.innerText).toEqual(expectedString(vals.at(-1)));
    })));
  });

  test("n times changing the value, asserting finished dom", () => {
    fc.assert(fc.property(fc.array(arbitraryJSXElement(), { minLength: 1 }), vals => testWrapper(container => {
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
    fc.assert(fc.property(fc.array(arbitraryJSXElement(), { minLength: 1 }), vals => testWrapper(container => {
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

test("patchElement of a dynamic with signal", () => testWrapper(container => {
  const [val, setVal] = createSignal<JSXElement>("previous value");
  const el = () => val();
  patchElement(container, null, null, el);
  expect(simplifyDom(container,false).children).toEqual(expectedSimplifiedDom(el));
  setVal("new value");
  expect(simplifyDom(container,false).children).toEqual(expectedSimplifiedDom(el));
  setVal("and again a new value");
  expect(simplifyDom(container,false).children).toEqual(expectedSimplifiedDom(el));
}));
