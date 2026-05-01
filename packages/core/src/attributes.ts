import type { ClassList, EventHandler, JSXElement } from ".";
import { renderClasslist } from ".";
import { getScope } from "@lentjs/core-reactivity";
import type { SSRElementBuilder } from "./render-to-string";
import { assert } from "@lentjs/utils";

export type AttributeValue = string | boolean | number | undefined;
export type Attributes = {
  children?: JSXElement,
  class?: ClassList,
  value?: string,
  checked?: boolean,
  disabled?: boolean,
} & {
  [key in `on:${string}`]?: EventHandler<Event>
} & {
  [key in `attr:${string}`]?: AttributeValue
} & {
  [key in `prop:${string}`]?: any
};

export type AttributeHandler<V> = {
  filter: string | RegExp,

  /**
   * If set to true, as soon as the runtime finds it, setOnHTMLElement
   * will be called with the deserialized value.
   * Used when you cannot represent this attribute's action in html. (event handlers)
   */
  forceResume: boolean,
  setOnHTMLElement(element: HTMLElement, propName: string, value: V): void;
  /**
   * Only called before serializing the element, not called everytime the value changes
   */
  setOnSSRElement(build: SSRElementBuilder, propName: string, value: V): void;
};
/// used for type inference
function handler<V>(v: AttributeHandler<V>): AttributeHandler<V> { return v }

const handlers: AttributeHandler<any>[] = [
  handler<ClassList>({
    filter: "class",
    forceResume: false,
    setOnHTMLElement(element, _, value) {
      element.className = renderClasslist(value).join(" ");
    },
    setOnSSRElement(builder, _, value) {
      builder.appendAttribute("class", renderClasslist(value).join(" "));
    },
  }),

  handler<EventHandler<Event>>({
    filter: /^on:/,
    forceResume: true,
    setOnHTMLElement(el, propName, value) {
      const tk = propName.slice(3);
      el.addEventListener(tk, value);
      getScope().onCleanup(() => el.removeEventListener(tk, value));
    },
    setOnSSRElement() { },
  }),
  handler<AttributeValue>({
    filter: /^attr:/,
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
    filter: /^prop:/,
    forceResume: false,
    setOnHTMLElement(el, propName, value) {
      const tk = propName.slice(5);
      assert(tk in el);
      //@ts-expect-error We trust that this is called with correct key/value for this element
      el[tk] = value;
    },
    setOnSSRElement() { },
  }),

  handler<unknown>({
    filter: /^(?:checked|value|disabled)$/,
    forceResume: false,
    setOnHTMLElement(element, propName, value) {
      if (propName in element)
        //@ts-expect-error We trust that this is called with correct key/value for this element
        element[propName] = value;
      else
        console.warn("Cannot set property:", propName, "is not in", element)
    },
    setOnSSRElement(builder, propName, value) {
      if (value === true) {
        builder.appendAttribute(propName);
      }
      else if (value != null && value !== false) {
        builder.appendAttribute(propName, value.toString());
      }
    },
  }),
];

export function getHandlerForAttribute(name: string): AttributeHandler<any> | null {
  for (const h of handlers) {
    const f = h.filter;
    if (typeof f === "string" && f === name)
      return h;
    if (f instanceof RegExp && f.test(name))
      return h;
  }
  console.warn(`Unsupported attribute ${name}`);
  return null;
}
