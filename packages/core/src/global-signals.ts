import { createContextKey, createSignal, getScope, type SignalAccessor, type SignalSetter } from "@lentjs/core-reactivity";

const resumedSignalContextId = createContextKey<[SignalAccessor<boolean>, SignalSetter<boolean>]>("__lentjs_resumedSignal");
function getResumedSignal(): [SignalAccessor<boolean>, SignalSetter<boolean>] {
  const scope = getScope();
  let resumedSignal = scope.tryGetContext(resumedSignalContextId);
  if (!resumedSignal) {
    resumedSignal = createSignal<boolean>(false);
    scope.root.setContext(resumedSignalContextId, resumedSignal);
  }
  return resumedSignal;
}

export function resumed(): boolean {
  return getResumedSignal()[0]();
}

export function setResumed() {
  getResumedSignal()[1](true);
}

