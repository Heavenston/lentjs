import { ownerToRoot, rootToOwner, type Owner } from "./owner-internal";
import { createOwner, enterOwner, getOwner, onCleanup } from "./owner";
import { microtaskDebounce, noop } from "@lentjs/utils";
import { listenForSignalReads, registerSignalCallback, type SignalCallback, type SignalId } from "./signal-internal";

declare const CapturedTaskReactivityData: unique symbol;
export type CapturedTaskReactivityData = Readonly<{ [CapturedTaskReactivityData]: "capturedTaskReactivityData", length: number }>;
export type CapturedTaskData = [cb: () => void, signalReads: CapturedTaskReactivityData];

export type TaskConfig = {
  initialCleanup?: () => void,
  parentOwner?: Owner | null,
  detachedFromParent?: boolean,
};

function taskReactivityData<T>(val: T): T extends CapturedTaskReactivityData ? SignalId[] : T extends SignalId[] ? CapturedTaskReactivityData : T {
  // @ts-ignore
  return val;
}

function internalCreateOrResumeTask(task: () => void, config: TaskConfig, resumeWithSignalReads?: SignalId[]) {
  const parentOwner = ownerToRoot(config.parentOwner === undefined ? getOwner() : config.parentOwner);
  let cleanup: () => void = config.initialCleanup ?? noop;
  let latestSignalReads: SignalId[] = [];

  const callAndSub = () => {
    cleanup();
    const [newOwner, newCleanup] = createOwner(rootToOwner(parentOwner));
    // Cleans up the owner when the parent is cleaned, but also unregisters the
    // cleanup callback from the parent when this one is cleaned
    if (!config.detachedFromParent && parentOwner)
      onCleanup(onCleanup(newCleanup, rootToOwner(parentOwner)), newOwner);
    cleanup = newCleanup;
    enterOwner(newOwner, () => {
      const signalReads: SignalId[] = [];
      listenForSignalReads(task, signalReads);
      latestSignalReads = signalReads;

      const cb: SignalCallback = { onUpdate: debounceRun };
      for (const signalId of signalReads)
        registerSignalCallback(cb, signalId);
      onCleanup(() => { cb.onUpdate = null; });
    });
  };
  const debounceRun = microtaskDebounce(callAndSub);

  if (parentOwner?.tasks != null) {
    parentOwner.tasks.push({
      cb: task,
      capture() {
        cleanup();
        return taskReactivityData(latestSignalReads);
      },
    });
  }
  
  if (resumeWithSignalReads) {
    const cb: SignalCallback = { onUpdate: debounceRun };
    for (const signalId of resumeWithSignalReads)
      registerSignalCallback(cb, signalId);
    if (parentOwner)
      onCleanup(() => { cb.onUpdate = null; });
  }
  else {
    callAndSub();
  }
}

export function createTask(task: () => void, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config);
}

export function resumeTask(task: () => void, reactivityData: CapturedTaskReactivityData, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config, taskReactivityData(reactivityData));
}

export function startTask<T>(task: () => T): [T, CapturedTaskReactivityData] {
  const signalReads: SignalId[] = [];
  const val = listenForSignalReads(task, signalReads);
  return [val, taskReactivityData(signalReads)];
}
