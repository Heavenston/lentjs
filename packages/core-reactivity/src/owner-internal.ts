import type { Root } from "./root-internal";

declare const ownerSymbol: unique symbol;
/**
 * Opaque type representing a root
 */
export type Owner = { [ownerSymbol]: "owner" };

export function ownerToRoot<O>(owner: O): O extends Owner ? Root : O {
  // @ts-ignore
  return owner;
}
export function rootToOwner<O>(root: O): O extends Root ? Owner : O {
  // @ts-ignore
  return root;
}
