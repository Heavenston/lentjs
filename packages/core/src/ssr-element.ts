import { escapeHtml } from "./escape-html";
import { assert } from "./utils";

const SSRElementMarker = Symbol("ssr-element-marker");
export type SSRElement = { [SSRElementMarker]: true, t: string };

export function newSSRElement(t: string): SSRElement {
  return { [SSRElementMarker]: true, t };
}

export function isSSRElement(t: unknown): t is SSRElement {
  return typeof t === "object" && t !== null && SSRElementMarker in t && t[SSRElementMarker] === true;
}

/// Taken from http://xahlee.info/js/html5_non-closing_tag.html
const selfClosingHTMLElement = [
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
  "param",
  "source",
  "track",
  "wbr",
  "command",
  "keygen",
  "menuitem",
];

export class SSRElementBuilder {
  #tag: string;
  #selfClosing: boolean;
  #attributes: string = "";
  #innerHTML: string = "";

  public get tag(): string { return this.#tag }
  public get attributes(): string { return this.#attributes }
  public get innerHTML(): string { return this.#innerHTML }
  public get selfClosing(): boolean { return this.#selfClosing }

  public constructor(tag: string) {
    this.#tag = tag;
    this.#selfClosing = selfClosingHTMLElement.includes(tag);
  }

  public appendAttribute(name: string, value: string | null = null): this {
    if (value == null) {
      this.#attributes += `${name} `;
    }
    else {
      this.#attributes += `${name}="${escapeHtml(value)}" `;
    }
    return this;
  }

  public appendInnerHTML(html: string) {
    assert(!this.#selfClosing, "Cannot add inner html to self closing tag");
    this.#innerHTML += html;
  }

  public appendInnerText(text: string) {
    assert(!this.#selfClosing, "Cannot add inner text to self closing tag");
    this.#innerHTML += escapeHtml(text);
  }

  public build(): SSRElement {
    if (this.#selfClosing) {
      return newSSRElement(`<${this.#tag} ${this.#attributes}>`);
    }
    else {
      return newSSRElement(`<${this.#tag} ${this.#attributes}>${this.#innerHTML}</${this.tag}>`);
    }
  }
}
