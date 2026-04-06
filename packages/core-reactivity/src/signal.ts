import { defineSerialization, register } from "@lentjs/core-serialize";
import { triggerSignalCallbacks, triggerSignalRead } from "./signal-internal";
import { createUid } from "@lentjs/utils";

type SignalState<V> = {
  readonly id: string,
  currentValue: V,
};

const signalAccessorSymbol = Symbol("signal-accessor");
const signalSetterSymbol = Symbol("signal-setter");
export type SignalData = { signalId: string };
export type SignalAccessor<V> = (() => V) & { [signalAccessorSymbol]: true } & SignalData;
export type SignalSetter<V> = ((new_val: V) => void) & { [signalSetterSymbol]: true, update: (cb: (old_val: V) => V) => void } & SignalData;

export function createSignal<V>(initialValue: V): [SignalAccessor<V>, SignalSetter<V>] {
  const state: SignalState<V> = { currentValue: initialValue, id: createUid() };
  return [createSignalAccessor(state), createSignalSetter(state)];
}

function createSignalAccessor<V>(state: SignalState<V>): SignalAccessor<V> {
  const accessor: SignalAccessor<V> = () => {
    triggerSignalRead(state.id);
    return state.currentValue;
  };
  accessor[signalAccessorSymbol] = true;
  accessor.signalId = state.id;
  defineSerialization(accessor, () => state, resumeSignalAccessor<V>);
  return accessor;
}

function createSignalSetter<V>(state: SignalState<V>): SignalSetter<V> {
  const setter: SignalSetter<V> = (new_value: V) => {
    const changed = new_value !== state.currentValue;
    state.currentValue = new_value;
    if (changed)
      triggerSignalCallbacks(state.id);
  };
  setter[signalSetterSymbol] = true;
  setter.signalId = state.id;
  setter.update = (updater: (old_val: V) => V) => {
    setter(updater(state.currentValue));
  };
  defineSerialization(setter, () => state, resumeSignalSetter<V>);
  return setter;
}

const resumeSignalAccessor = register(<V>(state: SignalState<V>): SignalAccessor<V> => {
  return createSignalAccessor(state);
}, "__lentjs_resumeSignalAccessor");
const resumeSignalSetter = register(<V>(state: SignalState<V>): SignalSetter<V> => {
  return createSignalSetter(state);
}, "__lentjs_resumeSignalSetter");

export function isSignalAccessor(val: unknown): val is SignalAccessor<unknown> {
  return typeof val === "function" && val !== null && signalAccessorSymbol in val && val[signalAccessorSymbol] === true;
}

export function isSignalSetter(val: unknown): val is SignalSetter<never> {
  return typeof val === "function" && val !== null && signalSetterSymbol in val && val[signalSetterSymbol] === true;
}
