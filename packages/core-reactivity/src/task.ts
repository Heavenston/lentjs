import { createControlledOwner, enterOwner, getOwner, onCleanup } from "./owner";
import { noop } from "@lentjs/utils";
import { createReaction, resumeReaction, type CapturedReactivityData } from "./reaction";

export type TaskConfig = {
  initialCleanup?: () => void,
};

function internalCreateOrResumeTask(task: () => void, config: TaskConfig, resumeWithReactivityData: CapturedReactivityData | null) {
  const parentOwner = getOwner();

  let previousCleanup = config.initialCleanup ?? noop;
  const cb = () => {
    previousCleanup();
    const [owner, cleanupOwner] = createControlledOwner(parentOwner);
    previousCleanup = cleanupOwner;
    enterOwner(owner, task);
  };
  const unsub = resumeWithReactivityData ? resumeReaction(cb, resumeWithReactivityData) : createReaction(cb);

  if (parentOwner) {
    onCleanup(() => unsub(), parentOwner);
  }
}

export function createTask(task: () => void, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config, null);
}

export function resumeTask(task: () => void, reactivityData: CapturedReactivityData, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config, reactivityData);
}
