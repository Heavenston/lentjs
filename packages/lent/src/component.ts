import type { JSXElement } from ".";
import { createStore, type Store } from "./store";

export abstract class Component<S extends object = {}, P = {}> {
  public static is_component_class: true = true;

  #state: Store<S> | undefined;

  #createInitialState(): Store<S> {
    return createStore(this.getInitialState());
  }
  
  protected get state(): Store<S> {
    if (this.#state === undefined) {
      this.#state = this.#createInitialState();
    }
    return this.#state;
  }

  constructor(public readonly props: Readonly<P>) {
    this.init?.();
  }

  protected init?(): void;
  protected abstract getInitialState(): S;
  abstract render(): JSXElement;
}

export type ComponentFactory<P, C extends Component<any, P>> = (((props: P) => C) & { is_component_class?: undefined }) | { is_component_class: true, new(props: P): C }
export function constructComponent<P, C extends Component<any, P>, F extends ComponentFactory<P, C>>(factory: F, props: P): C {
  if (factory.is_component_class)
    return new factory(props);
  else
    return factory(props);
}
