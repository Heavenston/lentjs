import { serialize } from "@lentjs/core-serialize";
import { startReaction, Scope, taskCaptureContextKey, type TaskCaptureData } from "@lentjs/core-reactivity";
import { DIRECTIVE_PREFIX, type DirectiveName, type Directives, type MarkerDirectiveName, ATTRIBUTE_PREFIX, type ResumeAttributesData, type DynamicAttributesData } from "./runtime";
import { escapeHtml } from "./escape-html";
import { global_directive_data_array, sharedSSRSerialize } from "./shared-globals";
import { isSSRElement, SSRElementBuilder, type SSRElement } from "./ssr-element";
import { ChildernArray } from "./children-array";
import { factory, isJSXElementDynamic, isJSXElementString, isJSXElementWithScope, type ComponentFn, type JSXElement } from ".";
import { getProperty } from "@lentjs/utils";
import { getHandlerForAttribute } from "./attributes";

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

export function stringifyJSXElement(el: JSXElement, isInsideDynamic: boolean = false, isComputedInArray: boolean = false): string {
  if (isSSRElement(el)) {
    return el.t;
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
  else if (isJSXElementDynamic(el)) {
    const [val, reactivityData] = startReaction(() => el());
    if (reactivityData.length <= 0 && !isInsideDynamic) {
      return stringifyJSXElement(val, false);
    }
    const prefix = createSSRDirective("dyn", {
      isComputedInArray,
      update: el,
      reactivityData: reactivityData,
    });
    const suffix = createSSRDirective("dyn/");
    return `${prefix}${stringifyJSXElement(val, true)}${suffix}`;
  }
  else if (isJSXElementWithScope(el)) {
    const prefix = createSSRDirective("sco", el.withScope);
    const suffix = createSSRDirective("sco/");
    return el.withScope.enter(() => {
      return `${prefix}${stringifyJSXElement(el.fun(), false)}${suffix}`;
    });
  }
  else if (el instanceof ChildernArray) {
    let t = "";
    for (let i = 0; i < el.length; i++) {
      if (t.length !== 0 && isInsideDynamic)
        t += createSSRDirective("sep");
      t += stringifyJSXElement(el.getOrComputed(i), isInsideDynamic, el.isComputed(i));
    }
    if (isInsideDynamic)
      return `${createSSRDirective("chi")}${t}${createSSRDirective("chi/")}`;
    else
      return t;
  }
  else if (Array.isArray(el)) {
    if (!isInsideDynamic) {
      return el.map(e => stringifyJSXElement(e, false)).join("");
    }

    const t = el.map(e => stringifyJSXElement(e, true)).join(createSSRDirective("sep"));
    return `${createSSRDirective("arr")}${t}${createSSRDirective("arr/")}`;
  }
  else {
    el satisfies Node;
    throw new Error("Node impossible on the server");
  }
}

export function createSSRElement(element: string, props: any): SSRElement {
  const builder = new SSRElementBuilder(element);

  const attributesResumeData: ResumeAttributesData = [];
  const dynamicAttributesData: DynamicAttributesData = [];

  for (const propName of Object.keys(props)) {
    // TODO: Children may be reactive too!(?)
    if (propName === "children") {
      builder.appendInnerHTML(stringifyJSXElement((getProperty<any, any>).bind(null, props, "children"), false));
      continue;
    }

    const attrHandler = getHandlerForAttribute(propName);
    if (attrHandler === null) continue;
    const [val, reactivityData] = startReaction(() => props[propName]);
    attrHandler.setOnSSRElement(builder, propName, val);
    if (reactivityData.length > 0)
      dynamicAttributesData.push([reactivityData, propName, (getProperty<any, any>).bind(null, props, propName)])
    if (attrHandler.forceResume)
      attributesResumeData.push([propName, val]);
    attrHandler.setOnSSRElement(builder, propName, val);
  }

  if (attributesResumeData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:res-attrs`, sharedSSRSerialize(attributesResumeData).toString());
  }
  if (dynamicAttributesData.length !== 0) {
    builder.appendAttribute(`${ATTRIBUTE_PREFIX}:dyn-attrs`, sharedSSRSerialize(dynamicAttributesData).toString());
  }
  
  return builder.build();
}

export function renderToString(el: ComponentFn<{}>): string {
  global_directive_data_array.length = 0;

  const [scope, cleanup] = Scope.createControlled();
  const taskCaptureData: TaskCaptureData = { capturedTasks: [] };
  scope.setContext(taskCaptureContextKey, taskCaptureData);
  const rootScopeDirective = createSSRDirective("sco", scope);
  const t = scope.enter(() => stringifyJSXElement(factory(el)));
  const tasksDirective = createSSRDirective("tasks", taskCaptureData);
  const directivesData = `<script lang="application/json" ${ATTRIBUTE_PREFIX}:data>${serialize(global_directive_data_array)}</script>`;
  // We need to cleanup after serialization otherwise we serialize the scopes in the cleaned state
  cleanup();
  return `${directivesData}${rootScopeDirective}${t}${tasksDirective}`;
}
