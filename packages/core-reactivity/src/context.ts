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
  if (root.contextValues.has(id))
    throw new Error("Current owner already has this context set");
  root.contextValues.set(id, val);
}

export function provideContextGlobally<T>(id: ContextId<T>, val: T) {
  let root = Root.currentRoot;
  if (root === null)
    throw new Error("Cannot provide context: No owner in scope");
  while (root.parent != null)
    root = root.parent;
  if (root.contextValues.has(id))
    throw new Error("Root owner already has this context set");
  root.contextValues.set(id, val);
}

export function tryGetContext<T>(id: ContextId<T>): T | undefined {
  let root = Root.currentRoot;
  if (root === null)
    throw new Error("Cannot get context: No owner in scope");
  while (root.parent != null && !root.contextValues.has(id))
    root = root.parent;
  return root.contextValues.get(id) as any;
}

export function getContext<T>(id: ContextId<T>): T {
  let root = Root.currentRoot;
  if (root === null)
    throw new Error("Cannot get context: No owner in scope");
  while (root != null && !root.contextValues.has(id))
    root = root.parent;
  if (root == null)
    throw new Error("Cannot get context: Context value not set");
  return root.contextValues.get(id) as any;
}
