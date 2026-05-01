/* eslint-disable @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/no-unsafe-argument */

/// This returns a proxy, that should act and behave like T, but only creates
/// the actual T object by calling the function when needed once than stores it
export function createLazyProxy<T extends object>(fn: () => T): T {
  type State = { object?: T };
  function getObject(state: State): T {
    if (!("object" in state))
      state.object = fn();
    // @ts-expect-error This would require exactOptionalPropertyTypes to work properly
    return state.object;
  }

  return new Proxy<State>({ }, {
    get(target, prop, receiver) {
      return Reflect.get(getObject(target), prop, receiver);
    },
    set(target, prop, value, receiver) {
      return Reflect.set(getObject(target), prop, value, receiver);
    },
    has(target, prop) {
      return Reflect.has(getObject(target), prop);
    },
    deleteProperty(target, prop) {
      return Reflect.deleteProperty(getObject(target), prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(getObject(target));
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(getObject(target), prop);
    },
    defineProperty(target, prop, descriptor) {
      return Reflect.defineProperty(getObject(target), prop, descriptor);
    },
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(getObject(target));
    },
    setPrototypeOf(target, proto) {
      return Reflect.setPrototypeOf(getObject(target), proto);
    },
    isExtensible(target) {
      return Reflect.isExtensible(getObject(target));
    },
    preventExtensions(target) {
      return Reflect.preventExtensions(getObject(target));
    },
    apply(target, thisArg, args) {
      return Reflect.apply(getObject(target) as any, thisArg, args);
    },
    construct(target, args, newTarget) {
      return Reflect.construct(getObject(target) as any, args, newTarget);
    }
  }) as T;
}
