import type { JSXElement } from ".";
import { createStore, type Store } from "./store";

export abstract class Component<S extends object = {}, P = {}> {
  static #components: Map<string, ComponentFactory<any, any, any>> = new Map;

  public static is_component_class: true = true;
  private static id_: string;

  public static get id(): string { return this.id_ }

  public static getComponentFromId(id: string): ComponentFactory<any, any, any> | null {
    return this.#components.get(id) ?? null;
  }

  protected static register(id: string) {
    this.id_ = id;
    Component.#components.set(
      id,
      // @ts-ignore
      this,
    );
  }

  #state: Store<S> | undefined;
  public readonly props: Readonly<P>;

  #createInitialState(): Store<S> {
    return createStore(this.getInitialState());
  }
  
  get state(): Store<S> {
    if (this.#state === undefined) {
      this.#state = this.#createInitialState();
    }
    return this.#state;
  }

  constructor(props: Readonly<P>, state?: S) {
    const this_class = this.constructor as { id?: string, name?: string };
    if (this_class.id === undefined) {
      throw new Error(`Class '${this_class.name}' not registered`);
    }

    if (state !== undefined)
      this.#state = createStore(state);

    this.props = props;
    this.init?.();
  }

  protected init?(): void;
  protected abstract getInitialState(): S;
  abstract render(): JSXElement;
}

// export type ComponentFactory<P, C extends Component<any, P>> = (((props: P) => C) & { is_component_class?: undefined }) | { is_component_class: true, new(props: P): C }
export type ComponentFactory<P, S extends object, C extends Component<S, P>> = { is_component_class: true, id: string, new(props: P, state?: S): C }
export function constructComponent<P, S extends object, C extends Component<S, P>, F extends ComponentFactory<P, S, C>>(factory: F, props: P, state?: S): C {
  return new factory(props, state);
  // if (factory.is_component_class)
  //   return new factory(props);
  // else
  //   return factory(props);
}
