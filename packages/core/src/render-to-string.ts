import { serialize } from "@lentjs/core-serialize";
import { Scope, taskCaptureContextId, type TaskCaptureData, type CapturedReactivityData, createReaction } from "@lentjs/core-reactivity";
import { DIRECTIVE_PREFIX, type DirectiveName, type Directives, type MarkerDirectiveName, ATTRIBUTE_PREFIX, type ResumeAttributesData, type DynamicAttributesData, type RuntimeSerializedData, type TaskResumeData } from "./runtime";
import { escapeHtml } from "./escape-html";
import { ChildrenArray, factory, isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, type ComponentFn, type JSXElement, type JSXElementString } from ".";
import { assert, notNull, unreachable } from "@lentjs/utils";
import { getHandlerForAttribute } from "./attributes";

const global_directive_data_array: unknown[] = [];

function sharedSSRSerialize(value: unknown): number {
  const idx = global_directive_data_array.length;
  global_directive_data_array.push(value);
  return idx;
}

function createSSRDirective<K extends MarkerDirectiveName>(name: K): string;
function createSSRDirective<K extends DirectiveName>(name: K, arg: Directives[K], embed?: boolean): string;
function createSSRDirective(name: string, arg: unknown = null, embed: boolean = false): string {
  if (arg === null) {
    return `<!--${DIRECTIVE_PREFIX} ${name}-->`;
  }
  else {
    return `<!--${DIRECTIVE_PREFIX} ${name} ${embed ? serialize(arg) : sharedSSRSerialize(arg)}-->`;
  }
}

export function isSSRElement(t: unknown): t is SSRElement {
  return t instanceof SSRElement;
}

/// Taken from http://xahlee.info/js/html5_non-closing_tag.html
const selfClosingHTMLElement = [
  "area",
  "base",
  "br",
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
];

type SSRElementDynamicValueRec<T> = {
  kind: "dynamic",
  function: unknown,
  unsub: () => [val: SSRElementValueRec<T>, CapturedReactivityData];
};
type SSRElementDynamicValue<T> = {
  kind: "dynamic",
  function: unknown,
  unsub: () => [val: T, CapturedReactivityData];
};
type SSRElementStaticValue<T> = {
  kind: "static",
  value: T,
};
type SSRElementValueRec<T> = SSRElementDynamicValueRec<T> | SSRElementStaticValue<T>;
type SSRElementValue<T> = SSRElementDynamicValue<T> | SSRElementStaticValue<T>;
type SSRElementChildArray = SSRElementChildValue[] & { wasChildrenArray?: boolean };
type SSRElementChild = null | undefined | JSXElementString | SSRElementChildArray | SSRElement;
type SSRElementChildValue = SSRElementValueRec<SSRElementChild>;

// Better than just 'arr instanceof ChildrenArray' because is keep 'T'
function isChildrenArray<T>(arr: T[]): arr is ChildrenArray<T> {
  return arr instanceof ChildrenArray;
}

function toSSRElementChild(el: JSXElement): SSRElementChildValue {
  if (el === null || el === undefined || isJSXElementString(el) || isSSRElement(el))
    return { kind: "static", value: el };

  if (isJSXElementDynamic(el)) {
    let latestReturnValue: JSXElement;
    let latestChildVal: SSRElementChildValue;
    const unsub = createReaction(() => {
      latestReturnValue = el(latestReturnValue);
      latestChildVal = toSSRElementChild(latestReturnValue);
    });
    return {
      kind: "dynamic",
      function: el,
      unsub: () => {
        const reactivityData = unsub();
        return [latestChildVal, reactivityData];
      },
    };
  }
  if (isJSXElementWithScope(el)) {
    return el.withScope.enter(() => toSSRElementChild(el.fun()));
  }
  if (Array.isArray(el) && isChildrenArray(el)) {
    const c: SSRElementChildArray = [];
    c.wasChildrenArray = true;
    for (let i = 0; i < el.length; i++) {
      // FIXME: This doesn't differenciate computed children elements vs dynamic elements inside the array
      c.push(toSSRElementChild(el.getOrComputed(i)));
    }
    return { kind: "static", value: c };
  }
  if (Array.isArray(el)) {
    return { kind: "static", value: el.map(toSSRElementChild) };
  }

  el satisfies ChildNode;
  assert(false, "Node as JSXElement not supported for render-to-string");
}

function stringifySSRElementChild(elValue: SSRElementChildValue, isInsideDynamic: boolean = false, isComputedInArray: boolean = false): string {
  switch (elValue.kind) {
  case "dynamic": {
    const [val, reactivityData] = elValue.unsub();

    if (reactivityData.length <= 0 && !isInsideDynamic) {
      return stringifySSRElementChild(val, false);
    }

    const prefix = createSSRDirective("dyn", {
      isComputedInArray,
      update: elValue.function as any,
      reactivityData: reactivityData,
    });
    const suffix = createSSRDirective("dyn/");
    return `${prefix}${stringifySSRElementChild(val, true)}${suffix}`;
  }
  case "static":
  }

  const el = elValue.value;

  if (isSSRElement(el)) {
    return el.build();
  }
  else if (isJSXElementString(el)) {
    return escapeHtml(el.toString());
  }
  else if (el === null) {
    return isInsideDynamic ? createSSRDirective("nul", null) : "";
  }
  else if (el === undefined) {
    return isInsideDynamic ? createSSRDirective("und", null) : "";
  }
  else if (Array.isArray(el)) {
    if (!isInsideDynamic) {
      return el.map(e => stringifySSRElementChild(e, false)).join("");
    }

    const t = el.map(e => stringifySSRElementChild(e, true)).join(createSSRDirective("sep"));
    const dt = el.wasChildrenArray ? "chi" : "arr";
    return `${createSSRDirective(dt)}${t}${createSSRDirective(`${dt}/`)}`;
  }

  unreachable(el);
}

class SSRElementBuilder {
  #tag: string;
  #selfClosing: boolean;
  #attributes: string = "";
  #innerHTML: string = "";

  public constructor(tag: string) {
    this.#tag = tag;
    this.#selfClosing = selfClosingHTMLElement.includes(tag);
  }

  public appendAttribute(name: string, value: string | null = null): this {
    if (value == null) {
      this.#attributes += ` ${name}`;
    }
    else {
      this.#attributes += ` ${name}="${escapeHtml(value)}"`;
    }
    return this;
  }

  public appendInnerHTML(html: string): void {
    if (html === "") return;
    assert(!this.#selfClosing, `Cannot add inner html to self closing tag (${this.#tag})`);
    this.#innerHTML += html;
  }

  public build(): string {
    if (this.#selfClosing) {
      return `<${this.#tag}${this.#attributes}>`;
    }
    else {
      return `<${this.#tag}${this.#attributes}>${this.#innerHTML}</${this.#tag}>`;
    }
  }
}
export type { SSRElementBuilder };

export class SSRElement {
  #tag: string;
  #props = new Map<string, SSRElementValue<unknown>>();
  #children: SSRElementChildValue;

  public constructor(tag: string, props: any) {
    this.#tag = tag;

    for (const propName of Object.keys(props)) {
      if (propName === "children") {
        continue;
      }

      const descriptor = notNull(Object.getOwnPropertyDescriptor(props, propName));
      if (descriptor.get) {
        let latestVal: any;
        const unsub = createReaction(() => {
          latestVal = props[propName];
        });
        this.#props.set(propName, {
          kind: "dynamic",
          function: descriptor.get as any,
          unsub: () => {
            const reactivityData = unsub();
            return [latestVal, reactivityData];
          },
        });
      }
      else {
        this.#props.set(propName, {
          kind: "static",
          value: props[propName],
        });
      }
    }

    this.#children = toSSRElementChild(props["children"]);
  }

  public build(): string {
    const builder = new SSRElementBuilder(this.#tag);
    const attributesResumeData: ResumeAttributesData = [];
    const dynamicAttributesData: DynamicAttributesData = [];

    for (const [propName, propValue] of this.#props) {
      const attrHandler = getHandlerForAttribute(propName);
      if (attrHandler === null) {
        console.warn(`Unsuported property '${propName}'`);
        continue;
      }

      let value: unknown;
      switch (propValue.kind) {
      case "dynamic": {
        const [val, reactivityData] = propValue.unsub();
        value = val;
        if (reactivityData.length > 0)
          dynamicAttributesData.push([reactivityData, propName, propValue.function as any])
        break;
      }
      case "static":
        value = propValue.value;
        break;
      }

      if (attrHandler.forceResume)
        attributesResumeData.push([propName, value]);

      attrHandler.setOnSSRElement(builder, propName, value);
    }

    if (attributesResumeData.length !== 0) {
      builder.appendAttribute(`${ATTRIBUTE_PREFIX}:res-attrs`, sharedSSRSerialize(attributesResumeData).toString());
    }
    if (dynamicAttributesData.length !== 0) {
      builder.appendAttribute(`${ATTRIBUTE_PREFIX}:dyn-attrs`, sharedSSRSerialize(dynamicAttributesData).toString());
    }

    builder.appendInnerHTML(stringifySSRElementChild(this.#children));

    return builder.build();
  }
}

export function createSSRElement(element: string, props: any): SSRElement {
  return new SSRElement(element, props);
}

export type RenderToStringCfg = {
  disableDataElement?: boolean,
};
export async function renderToString(el: ComponentFn<object>, cfg: RenderToStringCfg = {}): Promise<string> {
  const [scope, cleanup] = Scope.createControlled();
  const taskCaptureData: TaskCaptureData = { capturedTasks: [], capturedAsyncTasks: [] };
  scope.setContext(taskCaptureContextId, taskCaptureData);

  try {
    const t = scope.enter(() => toSSRElementChild(factory(el)));
    await Promise.allSettled(taskCaptureData.capturedAsyncTasks.map(t => t.promise));
    const taskResumeData: TaskResumeData = {
      tasks: taskCaptureData.capturedTasks,
      asyncTasks: taskCaptureData.capturedAsyncTasks.map(t => ({
        task: t.task,
        reactivityData: t.capture(),
        parentScope: t.parentScope,
      })),
    };
    const html = stringifySSRElementChild(t);
    const directivesData = cfg.disableDataElement ? "" : `<script lang="application/json" ${ATTRIBUTE_PREFIX}:data>${serialize({
      rootScope: scope,
      directivesData: global_directive_data_array,
      tasks: taskResumeData,
    } satisfies RuntimeSerializedData)}</script>`;
    return `${directivesData}${html}`;
  }
  finally {
    // We need to cleanup after serialization otherwise we serialize the scopes in the cleaned state
    cleanup();

    global_directive_data_array.length = 0;
  }
}
