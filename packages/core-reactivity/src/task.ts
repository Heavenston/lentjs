import { createControlledOwner, enterOwner, getOwner, onCleanup } from "./owner";
import { noop, remove } from "@lentjs/utils";
import { createReaction, resumeReaction, type CapturedReactivityData } from "./reaction";
import { convertOwner } from "./owner-internal";
import type { RootCaptureTaskData } from "./root-internal";

export type TaskCallback = () => void;

export type TaskConfig = {
  initialCleanup?: () => void,
};

function internalCreateOrResumeTask(task: TaskCallback, config: TaskConfig, resumeWithReactivityData: CapturedReactivityData | null) {
  const parentOwner = getOwner();
  const captureData = convertOwner(parentOwner)?.captureData ?? null;

  let previousCleanup = config.initialCleanup ?? noop;
  const cb = () => {
    previousCleanup();
    const [owner, cleanupOwner] = createControlledOwner(parentOwner);
    previousCleanup = cleanupOwner;
    enterOwner(owner, task);
  };
  const unsub = resumeWithReactivityData ? resumeReaction(cb, resumeWithReactivityData) : createReaction(cb);

  if (parentOwner) {
    if (captureData) {
      const data: RootCaptureTaskData = {
        task,
        capture: unsub,
        root: convertOwner(parentOwner),
      };
      captureData.tasks.push(data);
      onCleanup(() => {
        remove(captureData.tasks, data);
        unsub();
      }, parentOwner);
    }
    else {
      onCleanup(() => unsub(), parentOwner);
    }
  }
}

export function createTask(task: TaskCallback, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config, null);
}

export function resumeTask(task: TaskCallback, reactivityData: CapturedReactivityData, config: TaskConfig = {}) {
  internalCreateOrResumeTask(task, config, reactivityData);
}
