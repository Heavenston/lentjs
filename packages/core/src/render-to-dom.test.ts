import { test, expect } from "bun:test";
import { renderToDom } from ".";
import { simplifyDom } from "./patch-element.test";

test("Empty component", () => {
  const container = document.createElement("div");
  renderToDom(container, () => null);
  expect(simplifyDom(container).children).toMatchInlineSnapshot(`[]`);
});
