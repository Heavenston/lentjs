import type { JSXElement } from ".";
import { createStore, isStore, type Store } from "./store";
import { assert } from "./utils";

export abstract class Component<S extends object = {}, P = {}> {
  static #components: Map<string, ComponentFactory<any, any, any>> = new Map;
  static #componentInstances: Map<string, Component<any, any>> = new Map;

  public static is_component_class: true = true;
  private static id_: string;

  public static get id(): string { return this.id_ }

  public static listComponents() {
    return this.#components.values();
  }
  public static getFactoryFromId(id: string): ComponentFactory<any, any, any> | null {
    return this.#components.get(id) ?? null;
  }
  public static getInstanceFromId(id: string): Component<any, any> | null {
    return this.#componentInstances.get(id) ?? null;
  }

  protected static register(id: string) {
    id += `_${this.name}`;
    this.id_ = id;
    Component.#components.set(
      id,
      // @ts-ignore
      this,
    );
  }

  private id_: string;
  private state_: Store<S> | undefined;
  public readonly props: Readonly<P>;

  #createInitialState(): Store<S> {
    return createStore(this.getInitialState());
  }

  public get id(): string {
    return this.id_;
  }
  
  get state(): Store<S> {
    if (this.state_ === undefined) {
      this.state_ = this.#createInitialState();
    }
    return this.state_;
  }

  constructor(props: P, id?: string, state?: S) {
    this.id_ = id ?? crypto.randomUUID();
    assert(!Component.#componentInstances.has(this.id_));
    // FIXME: This leaks the component forever
    Component.#componentInstances.set(this.id_, this);

    const this_class = this.constructor as { id?: string, name?: string };
    if (this_class.id === undefined) {
      throw new Error(`Class '${this_class.name}' not registered`);
    }

    if (state !== undefined)
      this.state_ = isStore(state) ? state : createStore(state);

    this.props = props;
    this.init?.();
  }

  protected init?(): void;
  protected abstract getInitialState(): S;
  abstract render(): JSXElement;
}

export type ComponentFactory<P, S extends object, C extends Component<S, P>> = { is_component_class: true, id: string, new(props: P, id?: string, state?: S): C }
export function constructComponent<P, S extends object, C extends Component<S, P>, F extends ComponentFactory<P, S, C>>(factory: F, props: P, id?: string, state?: S): C {
  return new factory(props, id, state);
}
