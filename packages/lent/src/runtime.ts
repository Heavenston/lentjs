import { Component, deserialize } from ".";
import { constructComponent } from "./component";
import { isFunction } from "./utils";

type RunCtx = {
  component_stack: {
    id: string,
    instance: Component<any, any> | null,
  }[],
};
function run(n: Node, ctx: RunCtx) {
  n.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 3);
      if (parts[0] !== "lentjs") return;
      switch (parts[1]) {
      case "start":
        const previous_comp = ctx.component_stack.at(-1)?.instance ?? null;

        const cid = parts[2]!;
        const factory = Component.getComponentFromId(cid);
        if (!factory) {
          console.warn(`Could not find the component with id`, cid);
        }
        const { props, state } = deserialize(n.textContent.replace(/^([^ ]+ ){3}/, "")) as any;
        for (const [k, v] of Object.entries(props)) {
          if (isFunction(v)) {
            props[k] = new Function("return " + v.toString()).bind(previous_comp)();
          }
        }
        for (const [k, v] of Object.entries(state)) {
          if (isFunction(v)) {
            state[k] = new Function("return " + v.toString()).bind(previous_comp)();
          }
        }

        ctx.component_stack.push({
          id: cid,
          instance: factory ? constructComponent(factory, props, state) : null,
        });
        break;
      case "end":
        ctx.component_stack.pop();
        break;
      default:
        console.warn(`Uknown runtime directive ${parts[1]}`);
      }
    }

    if (n instanceof HTMLElement) {
      const current_comp = ctx.component_stack.at(-1)?.instance ?? null;

      for (const t of n.attributes) {
        if (t.name.startsWith("lentjs:on:")) {
          const event = t.name.replace(/^lentjs:on:/, "");
          const cb = new Function("return " + t.value).bind(current_comp)();
          n.addEventListener(event, cb);
        }

        if (t.name.startsWith("lentjs:attr:")) {
          const attr = t.name.replace(/^lentjs:attr:/, "");
          const cb = new Function("return " + t.value).bind(current_comp)();
        }
      }
    }

    run(n, ctx);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  run(rootElement, { component_stack: [] });
  console.timeEnd("startRuntime");
}

