import { createContextId, createSignal, provideContextGlobally, tryGetContext, type SignalAccessor, type SignalSetter } from "@lentjs/core-reactivity";

const ResumedSignalContextId = createContextId<[SignalAccessor<boolean>, SignalSetter<boolean>]>("__lentjs_resumedSignal");
function getResumedSignal(): [SignalAccessor<boolean>, SignalSetter<boolean>] {
  let resumedSignal = tryGetContext(ResumedSignalContextId);
  if (!resumedSignal) {
    resumedSignal = createSignal<boolean>(false);
    provideContextGlobally(ResumedSignalContextId, resumedSignal);
  }
  return resumedSignal;
}

export function resumed(): boolean {
  return getResumedSignal()[0]();
}

export function setResumed() {
  getResumedSignal()[1](true);
}

