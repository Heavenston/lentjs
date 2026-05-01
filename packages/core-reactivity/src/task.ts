import { assert, noop, remove } from "@lentjs/utils";
import { createReaction, resumeReaction, startReaction, type CapturedReactivityData } from "./reaction";
import { Scope } from "./scope";
import { taskCaptureContextId, type CapturedTaskData } from "./task-capture";

export type TaskCallback = () => void;

function internalCreateOrResumeTask(task: TaskCallback, resumeWithReactivityData: CapturedReactivityData | null) {
  const parentScope = Scope.currentScope;
  const taskCaptureData = parentScope?.tryGetContext(taskCaptureContextId) ?? null;

  let previousCleanup = noop;
  const cb = () => {
    previousCleanup();
    const [scope, cleanupScope] = Scope.createControlled(parentScope);
    previousCleanup = cleanupScope;
    scope.enter(task);
  };

  if (taskCaptureData) {
    assert(resumeWithReactivityData === null, "Cannot resume a task while capturing tasks");
    const [,reactivityData] = startReaction(task);
    const captured: CapturedTaskData = { parentScope, reactivityData, task };
    taskCaptureData.capturedTasks.push(captured);
    parentScope?.onCleanup(() => remove(taskCaptureData.capturedTasks, captured));
  }
  else {
    const unsub = resumeWithReactivityData ? resumeReaction(cb, resumeWithReactivityData) : createReaction(cb);
    parentScope?.onCleanup(() => unsub());
  }
}

export function createTask(task: TaskCallback): void {
  internalCreateOrResumeTask(task, null);
}

export function resumeTask(task: TaskCallback, reactivityData: CapturedReactivityData): void {
  internalCreateOrResumeTask(task, reactivityData);
}
