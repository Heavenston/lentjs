import { Component, deserialize } from ".";
import { constructComponent } from "./component";
import { isClassMethod } from "./serialize";
import { isSignalAccessor, isSignalSetter, resumeStore, signals, type StoreReadCallback } from "./store";
import { isBindableThis, isFunction } from "./utils";

function closureBind(f: Function, new_this: object | null): Function {
  if (isClassMethod(f) || isBindableThis(f)) {
    return f.bind(new_this);
  }
  else {
    // console.warn("Rebinding closure: ", f.toString());
    try {
      return new Function("return " + f.toString()).call(new_this);
    }
    catch(e) {
      console.error("Error rebinding:", e);
      return () => { throw new Error("Error rebinding this function") };
    }
  }
}

function rebindFunctions<O extends object>(obj: O, new_this: object | null) {
  for (const [k, v] of Object.entries(obj) as [keyof O, O[keyof O]][]) {
    let new_val: any = v;
    if (isSignalAccessor(v) || isSignalSetter(v)) continue;
    if (isFunction(v)) {
      new_val = closureBind(v, new_this);
    }
    obj[k] = new_val;
  }
}

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
      const parts_rest = n.textContent.replace(/^([^ ]+ +){3}/, "");

      switch (parts[1]) {
      case "state": {
        const state_data = deserialize(parts_rest) as [string, any][];
        if (parts[2] === "signals") {
          for (const [id, val] of state_data) {
            signals.set(id, {
              callbacks: [],
              currentValue: val,
            });
          }
        }
        else if (parts[2] === "stores") {
          for (const [id, val] of state_data) {
            resumeStore(id, val);
          }
        }
      }
        break;
      case "start-component":
        const previous_comp = ctx.component_stack.at(-1)?.instance ?? null;

        const cid = parts[2]!;
        const factory = Component.getComponentFromId(cid);
        if (!factory) {
          console.warn(`Could not find the component with id`, cid);
        }
        const { props, state } = deserialize(parts_rest) as any;
        rebindFunctions(props, previous_comp);
        rebindFunctions(state, previous_comp);

        ctx.component_stack.push({
          id: cid,
          instance: factory ? constructComponent(factory, props, state) : null,
        });
        break;
      case "end-component":
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
          // @ts-ignore
          const cb: any = closureBind(deserialize(t.value), current_comp);
          n.addEventListener(event, cb);
        }

        if (t.name.startsWith("lentjs:attr:")) {
          // TODO
          const attr = t.name.replace(/^lentjs:attr:/, "");
          const cb = deserialize(t.value) as { found_reads: NonNullable<StoreReadCallback["found_reads"]>, callback: () => any };
          console.log(attr, cb);
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

