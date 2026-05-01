import { test, expect, describe, afterAll, beforeAll } from "bun:test";
import { createHTMLElement, renderToDom } from "./render-to-dom";
import { isInTrackingContext, Scope } from "@lentjs/core-reactivity";
import fc from "fast-check";
import { arbitraryJSXElement, arbitraryJSXElementDynamic, asciiLowercase, expectedSimplifiedDom, isValidAttributeName, simplifyDom } from "./dom-test-utils";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

function testWrapper(fn: () => void) {
  const [scope, cleanup] = Scope.createControlled();
  scope.enter(() => {
    fn();
  });
  cleanup();
}

beforeAll(() => {
  GlobalRegistrator.register();
})

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

describe("createHTMLElement", () => {
  test("just a %p and no props", () => {
    fc.assert(fc.property(fc.string({ minLength: 1 }), tag => {
      const h = createHTMLElement(tag, {});
      expect(simplifyDom(h)).toEqual({ kind: "element", tag: tag.toUpperCase(), attributes: [], children: [], id: 0 });
    }));
  });

  test("attr:* should set attr value as a string", () => {
    const propsArbitrary = fc.object({
      key: fc.string().filter(isValidAttributeName).map(asciiLowercase).map(n => `attr:${n}`),
      values: [fc.string()],
      maxDepth: 0,
    });
    fc.assert(fc.property(propsArbitrary, props => {
      const h = createHTMLElement("div", props);
      expect(simplifyDom(h)).toEqual({
        kind: "element",
        tag: "DIV",
        attributes: (Object.entries(props) as [string, string][]).map(([k, v]) => [k.replace(/^attr:/, ""), v]),
        children: [],
        id: 0,
      });
    }));
  });

  test("attr:* with boolean should use empty strings", () => {
    const propsArbitrary = fc.object({
      key: fc.string().filter(isValidAttributeName).map(asciiLowercase).map(n => `attr:${n}`),
      values: [fc.boolean()],
      maxDepth: 0,
    });
    fc.assert(fc.property(propsArbitrary, props => {
      const h = createHTMLElement("div", props);
      expect(simplifyDom(h)).toEqual({
        kind: "element",
        tag: "DIV",
        attributes: (Object.entries(props) as [string, boolean][]).filter(([,v]) => v).map(([k]) => [k.replace(/^attr:/, ""), ""]),
        children: [],
        id: 0,
      });
    }));
  });

  test("children property yields correct children simplified dom", () => {
    fc.assert(fc.property(arbitraryJSXElement(), children => testWrapper(() => {
      const h = createHTMLElement("div", {
        children,
      });
      expect(simplifyDom(h, false)).toEqual({
        kind: "element",
        tag: "DIV",
        attributes: [],
        children: expectedSimplifiedDom(children),
      });
    })));
  });
});

describe("renderToDom", () => {
  test("can run without a parent scope", () => {
    renderToDom(document.createElement("div"), () => {
      expect(Scope.currentScope).not.toBeNull();
      return null;
    });
  });

  test("component is run with a child scope", () => {
    const parent = Scope.create();
    parent.enter(() => {
      renderToDom(document.createElement("div"), () => {
        expect(Scope.currentScope?.root).toBe(parent);
        return null;
      });
    });
  });

  test("component is not run withing a tracking context", () => {
    const parent = Scope.create();
    parent.enter(() => {
      renderToDom(document.createElement("div"), () => {
        expect(isInTrackingContext()).toBeFalse();
        return null;
      });
    });
  });

  test("works with any JSXElement, assert valid simplidiedDom", () => {
    fc.assert(fc.property(arbitraryJSXElementDynamic(), el => {
      const container = document.createElement("div");
      renderToDom(container, () => el);
      expect(simplifyDom(container, false).children).toEqual(expectedSimplifiedDom(el));
    }));
  });
});
