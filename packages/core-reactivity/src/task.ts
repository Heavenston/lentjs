import { assert, noop, remove } from "@lentjs/utils";
import { createReaction, resumeReaction, startReaction, type CapturedReactivityData } from "./reaction";
import { createContextId, Scope, type ContextId } from "./scope";

export type TaskCallback = () => void;

export type TaskConfig = {
  initialCleanup?: () => void,
};

export type CapturedTaskData = {
  task: TaskCallback,
  reactivityData: CapturedReactivityData,
  parentScope: Scope | null,
};
export type TaskCaptureData = {
  capturedTasks: CapturedTaskData[],
};
export const taskCaptureContextId: ContextId<TaskCaptureData> = createContextId<TaskCaptureData>("__lentjs_taskCaptureData", { noSerialize: true });

function internalCreateOrResumeTask(task: TaskCallback, config: TaskConfig, resumeWithReactivityData: CapturedReactivityData | null) {
  const parentScope = Scope.currentScope;
  const taskCaptureData = parentScope?.tryGetContext(taskCaptureContextId) ?? null;

  let previousCleanup = config.initialCleanup ?? noop;
  const cb = () => {
    previousCleanup();
    const [scope, cleanupScope] = Scope.createControlled(parentScope);
    previousCleanup = cleanupScope;
    scope.enter(task);
  };

  if (taskCaptureData) {
    assert(resumeWithReactivityData === null, "Cannot resume a task while capturing tasks");
    const [_void, reactivityData] = startReaction(task);
    const captured: CapturedTaskData = { parentScope, reactivityData, task };
    taskCaptureData.capturedTasks.push(captured);
    parentScope?.onCleanup(() => remove(taskCaptureData.capturedTasks, captured));
  }
  else {
    const unsub = resumeWithReactivityData ? resumeReaction(cb, resumeWithReactivityData) : createReaction(cb);
    parentScope?.onCleanup(() => unsub());
  }
}

export function createTask(task: TaskCallback, config: TaskConfig = {}): void {
  internalCreateOrResumeTask(task, config, null);
}

export function resumeTask(task: TaskCallback, reactivityData: CapturedReactivityData, config: TaskConfig = {}): void {
  internalCreateOrResumeTask(task, config, reactivityData);
}
