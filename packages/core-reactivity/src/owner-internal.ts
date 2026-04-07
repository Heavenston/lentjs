import type { Root } from "./root-internal";

declare const ownerSymbol: unique symbol;
/**
 * Opaque type representing a root
 */
export type Owner = { [ownerSymbol]: "owner", readonly cleaned: boolean, readonly detached: boolean };

// Compile time check that root have the correct additional properties
declare const P: Root & { [ownerSymbol]: "owner" };
if (false as true)
  P satisfies Owner;

/**
 * Noop function for converting between owner and root
 */
export function convertOwner<O>(owner: O): O extends Owner ? Root : O extends Root ? Owner : O {
  // @ts-ignore
  return owner;
}
