import { afterEach } from "bun:test";
import { isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, isSSRElement, type JSXElement, type JSXElementDynamic, type JSXElementSingular, type JSXElementString } from ".";
import fc from "fast-check";
import { assert, unreachable } from "@lentjs/utils";

fc.configureGlobal({
  seed: 69,
  numRuns: 200,
  includeErrorInReport: true,
  skipEqualValues: true,
  afterEach: () => {
    fullReset();
  },
});

afterEach(() => {
  fullReset();
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

export function fullReset(): void {
  document.body.innerHTML = "";
  nodeIds.clear();
}

const arbitraries = fc.letrec<{
  arbitraryJSXElementString: JSXElementString,
  arbitraryJSXElementSingular: JSXElementSingular,
  arbitraryJSXElementDynamic: JSXElementDynamic,
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
  arbitraryJSXElementDynamic: rec("arbitraryJSXElement").map(e => {
    const f = () => e;
    f.toString = () => `(() => ${fc.stringify(e)})`;
    return f;
  }),
  arbitraryJSXElement: fc.oneof(
    { withCrossShrink: true, depthSize: "xsmall", depthIdentifier: "id:arbitraryJSXElement" },
    rec("arbitraryJSXElementString"),
    fc.array(rec("arbitraryJSXElementSingular"), { size: "small", depthIdentifier: "id:arbitraryJSXElement" }),
    rec("arbitraryJSXElementDynamic"),
  ),
}));
export const arbitraryJSXElement: fc.Arbitrary<JSXElement> = arbitraries.arbitraryJSXElement;
export const arbitraryJSXElementDynamic: fc.Arbitrary<JSXElementDynamic> = arbitraries.arbitraryJSXElementDynamic;

