import { Component, deserialize, renderClasslist, setAttribute, type ClassList, type JSXElement } from ".";
import { constructComponent } from "./component";
import { isClassMethod } from "./serialize";
import { isSignalAccessor, isSignalSetter, listenForStoreReads, resumeStore, signals, stores, subscribeToStoreReads, type StoreRead } from "./store";
import { fullCall, isBindableThis, isFunction, microtaskDebounce } from "./utils";

function closureBind<F extends Function>(f: F, new_this: object | null): F {
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
      // @ts-ignore
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

export type RuntimeDynamicState = {
  storeReads: StoreRead[],
  update: (previous?: JSXElement) => JSXElement,
};

type RunCtx = {
  component_stack: {
    id: string,
    instance: Component<any, any> | null,
  }[],
  dynamic_stack: {
    storeReads: StoreRead[],
    update: (previous?: JSXElement) => JSXElement,
  }[],
};
function run(n: Node, ctx: RunCtx) {
  n.childNodes.forEach(n => {
    if (n instanceof Comment) {
      const parts = n.textContent.split(" ", 2);
      if (parts[0] !== "lentjs") return;
      const parts_rest = n.textContent.replace(/^([^ ]+ +){2}/, "");

      switch (parts[1]) {
      case "signals": {
        const signals_data = deserialize(parts_rest) as [string, any][];
        for (const [id, val] of signals_data) {
          signals.set(id, {
            callbacks: [],
            currentValue: val,
          });
        }
        break;
      }
      case "stores": {
        const stores_data = deserialize(parts_rest) as [string, any][];
        for (const [id, val] of stores_data) {
          resumeStore(id, val);
        }
        break;
      }
      case "start-component":
        const previous_comp = ctx.component_stack.at(-1)?.instance ?? null;

        const { id: cid, props, state } = deserialize(parts_rest) as any;

        const factory = Component.getComponentFromId(cid);
        if (!factory) {
          console.warn(`Could not find the component with id`, cid);
        }

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
      case "start-dynamic": {
        const current_component = ctx.component_stack.at(-1)?.instance ?? null;
        let { storeReads, update } = deserialize(parts_rest) as RuntimeDynamicState;

        ctx.dynamic_stack.push({
          storeReads,
          update: closureBind(update, current_component),
        });

        break;
      }
      case "end-dynamic": {
        const { storeReads, update } = ctx.dynamic_stack.pop()!;
        const end = n;
        const parent = n.parentNode!;

        // {
        //   const unsubscribe = () => currentUnsubscribe();
        //   let resultState: JSXStateArray = [];
        //   const hh = microtaskDebounce(() => {
        //     const [newChild, newStoreReads] = listenForStoreReads(() => update());
        //     resultState = patchElementArray(parent, end, resultState, newChild);
        //     currentUnsubscribe = subscribeToStoreReads(hh, newStoreReads, { once: true });
        //   });
        //   let currentUnsubscribe = subscribeToStoreReads(hh, storeReads, { once: true });
        // }

        break;
      }
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
          const attr = t.name.replace(/^lentjs:attr:/, "");
          let { callback, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], callback: () => any };

          callback = closureBind(callback, current_comp);

          const hh = microtaskDebounce(() => {
            const [new_value, new_found_reads] = listenForStoreReads(() => callback());
            setAttribute(n, attr, new_value);
            subscribeToStoreReads(hh, new_found_reads, { once: true });
          });
          subscribeToStoreReads(hh, found_reads, { once: true });
        }

        if (t.name.startsWith("lentjs:class")) {
          let { update, found_reads } = deserialize(t.value) as { found_reads: StoreRead[], update: () => ClassList };

          update = closureBind(update, current_comp);

          const hh = microtaskDebounce(() => {
            const [new_value, new_found_reads] = listenForStoreReads(() => update());
            n.className = "";
            n.classList.add(...renderClasslist(new_value));
            subscribeToStoreReads(hh, new_found_reads, { once: true });
          });
          subscribeToStoreReads(hh, found_reads, { once: true });
        }
      }
    }

    run(n, ctx);
  });
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  run(rootElement, { component_stack: [], dynamic_stack: [] });
  console.timeEnd("startRuntime");
}

