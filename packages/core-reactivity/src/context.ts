import { Root } from "./root-internal";

declare const contextIdSymbol: unique symbol;
export type ContextId<in T> = { [contextIdSymbol]: "contextId" };

export function createContextId<T>(id: string): ContextId<T> {
  return id as unknown as ContextId<T>;
}

export function provideContext<T>(id: ContextId<T>, val: T) {
  const root = Root.currentRoot;
  if (root === null)
    throw new Error("Cannot provide context: No owner in scope");
  root.setContextValue(id, val);
}

export function getContext<T>(id: ContextId<T>): T {
  const root = Root.currentRoot;
  if (root === null)
    throw new Error("Cannot get context: No owner in scope");
  const val = root.getContextValue(id);
  if (val === undefined)
    throw new Error("Cannot get context: Context value not set");
  return val as T;
}
