import { test, expect, describe } from "bun:test";
import fc from "fast-check";
import { arbitraryHTMLTag, arbitraryJSXElement, expectedSimplifiedDom, expectedString, isValidHTMLAttributeName, registerDocumentTests, simplifyDom } from "./dom-test-utils";
import { renderToString } from "./render-to-string";
import { SSRElement } from "./render-to-string";

registerDocumentTests();

describe("createSSRElement", () => {
  test("element with no props, asserts html gets parsed the same", () => {
    fc.assert(fc.property(arbitraryHTMLTag, tag => {
      const el = new SSRElement(tag, {});
      const html = el.build();
      document.body.innerHTML = html;
      expect(html).toEqual(document.body.innerHTML);
    }));
  });

  test("element with a (non empty) string children, asserts a single text node gets parsed", () => {
    fc.assert(fc.property(fc.tuple(arbitraryHTMLTag, fc.string({ minLength: 1 })), ([tag, content]) => {
      const el = new SSRElement(tag, {
        children: content,
      });
      const html = el.build();
      document.body.innerHTML = html;
      expect(simplifyDom(document.body, false).children).toEqual([{
        kind: "element",
        attributes: [],
        tag: tag.toUpperCase(),
        children: [
          { kind: "text", content },
        ],
      }]);
    }));
  });

  test("element with attr:* props, asserts parsed correctly", () => {
    const propsArbitrary = fc.object({
      key: fc.string().filter(isValidHTMLAttributeName).map(n => `attr:${n}`),
      values: [fc.string()],
      maxDepth: 0,
    });
    fc.assert(fc.property(fc.tuple(arbitraryHTMLTag, propsArbitrary), ([tag, props]) => {
      const el = new SSRElement(tag, props);
      const html = el.build();
      document.body.innerHTML = html;
      expect(simplifyDom(document.body, false).children).toEqual([{
        kind: "element",
        attributes: (Object.entries(props) as [string, string][]).map(([k, v]) => [k.replace(/^attr:/, ""), v]),
        tag: tag.toUpperCase(),
        children: [],
      }]);
    }));
  });
});

describe("renderToString", () => {
  test("Single component, any jsx element (no SSRElement), assert output html is straigt up the text", async () => {
    await fc.assert(fc.asyncProperty(arbitraryJSXElement({ disableDomNodes: true }), async val => {
      const t = await renderToString(() => val, { disableDataElement: true });
      expect(t).toEqual(expectedString(val));
    }));
  });

  test("Single component, any jsx element (including SSRlement), assert output html is parsed correctly", async () => {
    await fc.assert(fc.asyncProperty(arbitraryJSXElement({ disableDomNodes: true, enableSSRElements: true }), async val => {
      const t = await renderToString(() => val, { disableDataElement: true });
      document.body.innerHTML = t;
      expect(simplifyDom(document.body, false).children).toEqual(expectedSimplifiedDom(val,  true));
    }));
  });
});
