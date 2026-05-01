import { afterAll, afterEach, beforeAll } from "bun:test";
import { isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, isSSRElement, SSRElement, startReaction, type JSXElement, type JSXElementDynamic, type JSXElementSingular, type JSXElementString } from ".";
import fc from "fast-check";
import { assert, unreachable } from "@lentjs/utils";
import * as hp from "happy-dom";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

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

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

const fakeWindow = new hp.Window();
const fakeDiv = fakeWindow.document.createElement("div");

export function asciiLowercase(name: string): string {
  return name.replace(/[A-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 32));
}

export function isValidAttributeName(name: string): boolean {
  try {
    fakeDiv.setAttribute(name, "");
    return true;
  }
  catch {
    return false;
  }
}

export function isValidHTMLAttributeName(name: string): boolean {
  try {
    fakeDiv.innerHTML = `<div ${name}></div>`;
    return fakeDiv.children.item(0)!.getAttributeNames()[0] === name;
  }
  catch {
    return false;
  }
}

export function registerDocumentTests(): void {
  beforeAll(() => {
    GlobalRegistrator.register();
  })

  afterAll(async () => {
    await GlobalRegistrator.unregister();
  });
}

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

const extendedSSRElementData = Symbol();
type ExtendedSSRElementData = {
  tag: string,
  children: JSXElement,
};
/**
 * Used to add information about how the element was constructed to reconstruct
 * expected data during testing
 */
type ExtendedSSRElement = SSRElement & { [extendedSSRElementData]: ExtendedSSRElementData };
type PartialExtendedSSRElement = SSRElement & { [extendedSSRElementData]?: ExtendedSSRElementData };
function isExtendedSSRElement(el: SSRElement): el is ExtendedSSRElement {
  return extendedSSRElementData in el;
}

export function expectedString(el: JSXElement): string {
  if (el === null || el === undefined)
    return "";
  if (isJSXElementString(el))
    return el.toString();
  if (isJSXElementDynamic(el))
    return expectedString(el());
  if (isJSXElementWithScope(el))
    return el.withScope.enter(() => expectedString(el.fun()));
  if (isSSRElement(el))
    assert(false, "SSRElement does not yield straight text");
  if (Array.isArray(el))
    return el.map(expectedString).join("");
  if (el instanceof Node)
    return el.textContent ?? "";
  unreachable(el);
}

export function expectedSimplifiedDom(el: JSXElement, parsed: boolean = false): SimplifiedDom[] {
  if (el === null || el === undefined)
    return [];
  if (isJSXElementString(el)) {
    const content = el.toString();
    if (content.length === 0 && parsed)
      return [];
    else
      return [{ kind: "text", content }];
  }
  if (isJSXElementDynamic(el)) {
    const [val, reactivityData] = startReaction(el);
    if (reactivityData.length === 0)
      return expectedSimplifiedDom(val, parsed);
    return [
      { kind: "comment", content: "runtime-dyn-start" },
      ...expectedSimplifiedDom(val, parsed),
      { kind: "comment", content: "runtime-dyn-end" },
    ];
  }
  if (isJSXElementWithScope(el))
    return expectedSimplifiedDom(el.withScope.enter(el.fun), parsed);
  if (isSSRElement(el)) {
    assert(isExtendedSSRElement(el));
    return [{
      kind: "element",
      tag: el[extendedSSRElementData].tag.toUpperCase(),
      attributes: [],
      children: expectedSimplifiedDom(el[extendedSSRElementData].children, parsed),
    }];
  }
  if (Array.isArray(el)) {
    const result = el.flatMap(t => expectedSimplifiedDom(t, parsed));
    if (parsed) {
      // Concatenates adjacent text nodes into a single big text nodes
      // because that is how html will parse
      let concated: SimplifiedDom[] = result.length === 0 ? [] : [result[0]!];
      for (let i = 1; i < result.length; i++) {
        const last = concated.at(-1)!;
        const curr = result[i]!;
        if (last.kind === "text" && curr.kind === "text") {
          last.content += curr.content;
        }
        else {
          concated.push(curr);
        }
      }
      return concated;
    }
    else {
      return result;
    }
  }
  if (el instanceof Node)
    return [simplifyDom(el, false)];
  unreachable(el);
}

export function fullReset(): void {
  if (typeof document !== "undefined")
    document.body.innerHTML = "";
  nodeIds.clear();
}

export const arbitraryHTMLTag: fc.Arbitrary<string> = fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter(p => !Array.of<string>(
  // Cannot use these elements without a specific parent element
  "th", "td", "tr",
).includes(p));

export type ArbitraryJSXElementCfg = {
  disableDomNodes?: boolean,
  enableSSRElements?: boolean,
};

const jsxArbitraries = (cfg: ArbitraryJSXElementCfg = {}) => fc.letrec<{
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
    ...(!cfg.disableDomNodes ? [
      fc.constant("div").map(name => document.createElement(name)),
      rec("arbitraryJSXElementString").map(t => document.createTextNode(t.toString())),
    ] : []),
    ...(cfg.enableSSRElements ? [
      fc.tuple(arbitraryHTMLTag.filter(tag => !voidElements.has(tag)), rec("arbitraryJSXElement"))
        .map(([tag, children]) => {
          const el: PartialExtendedSSRElement = new SSRElement(tag, { children });
          el[extendedSSRElementData] = { tag, children };
          return el;
        }),
    ] : []),
  ),
  arbitraryJSXElementDynamic: rec("arbitraryJSXElement").map(e => {
    const f = () => e;
    f.toString = () => `(() => ${fc.stringify(e)})`;
    return f;
  }),
  arbitraryJSXElement: fc.oneof(
    { withCrossShrink: true, depthSize: "xsmall", depthIdentifier: "id:arbitraryJSXElement" },
    rec("arbitraryJSXElementSingular"),
    fc.array(rec("arbitraryJSXElement"), { size: "small", depthIdentifier: "id:arbitraryJSXElement" }),
    rec("arbitraryJSXElementDynamic"),
  ),
}));
export const arbitraryJSXElement: (cfg?: ArbitraryJSXElementCfg) => fc.Arbitrary<JSXElement>
  = (cfg = {}) => jsxArbitraries(cfg).arbitraryJSXElement;
export const arbitraryJSXElementDynamic: (cfg?: ArbitraryJSXElementCfg) => fc.Arbitrary<JSXElementDynamic>
  = (cfg = {}) => jsxArbitraries(cfg).arbitraryJSXElementDynamic;

