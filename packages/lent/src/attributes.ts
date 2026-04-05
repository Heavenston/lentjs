import { renderClasslist, type ClassList, type EventHandler, type JSXElement } from ".";
import type { SSRElementBuilder } from "./ssr-element";

export type AttributeValue = string | boolean | number | undefined;
export type Attributes = {
  children?: JSXElement,
  class?: ClassList | (() => ClassList),
  value?: string | (() => string),
  checked?: boolean | (() => boolean),
} & {
  [key in `on:${string}`]?: EventHandler<Event>
} & {
  [key in `attr:${string}`]?: AttributeValue | (() => AttributeValue)
} & {
  [key in `prop:${string}`]?: () => any
};

export type AttributeHandler<V> = {
  filter: (name: string) => boolean,

  /**
   * If set to true, dynamic values (function) will be handled before calling
   * the set* functions defined here.
   * So setOnHTMLElement will be called automatically when the value changes
   */
  managedDynamic: boolean,
  /**
   * If set to true, as soon as the runtime finds it, setOnHTMLElement
   * will be called with the deserialized value.
   * Used when you cannot represent this attribute's action in html. (event handlers)
   * This doesn't affect subsequent updates for managed dynamics.
   */
  forceResume: boolean,
  setOnHTMLElement(element: HTMLElement, propName: string, value: V): void;
  setOnSSRElement(builder: SSRElementBuilder, propName: string, value: V): void;
};
/// used for type inference
function handler<V>(v: AttributeHandler<V>): AttributeHandler<V> { return v }

const handlers: AttributeHandler<any>[] = [
  handler<ClassList>({
    filter: name => name === "class",
    managedDynamic: true,
    forceResume: false,
    setOnHTMLElement(element, _, value) {
      element.className = renderClasslist(value).join(" ");
    },
    setOnSSRElement(builder, _, value) {
      builder.appendAttribute("class", renderClasslist(value).join(" "));
    },
  }),

  handler<EventHandler<Event>>({
    filter: name => name.startsWith("on:"),
    managedDynamic: false,
    forceResume: true,
    setOnHTMLElement(el, propName, value) {
      const tk = propName.slice(3);
      if (value !== undefined)
        el.addEventListener(tk, value);
      else
        el.removeAttribute(tk);
    },
    setOnSSRElement() { },
  }),
  handler<AttributeValue>({
    filter: name => name.startsWith("attr:"),
    managedDynamic: true,
    forceResume: false,
    setOnHTMLElement(el, propName, value) {
      const tk = propName.slice(5);
      if (value == null || value === false) {
        el.removeAttribute(tk);
      }
      else if (value === true) {
        el.setAttribute(tk, "");
      }
      else {
        el.setAttribute(tk, value.toString());
      }
    },
    setOnSSRElement(builder, propName, value) {
      const tk = propName.slice(5);
      if (value === true) {
        builder.appendAttribute(tk);
      }
      else if (value != null && value !== false) {
        builder.appendAttribute(tk, value.toString());
      }
    },
  }),
  handler<unknown>({
    filter: name => name.startsWith("prop:"),
    managedDynamic: true,
    forceResume: false,
    setOnHTMLElement(el, propName, value) {
      const tk = propName.slice(5);
      // @ts-ignore
      el[tk] = value;
    },
    setOnSSRElement() { },
  }),
];

export function getHandlerForAttribute(name: string): AttributeHandler<any> | null {
  for (const h of handlers)
    if (h.filter(name))
      return h;
  console.warn(`Unsupported attribute ${name}`);
  return null;
}
