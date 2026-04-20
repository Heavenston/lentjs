import type { AsyncTaskCallback } from "./async-task";
import type { CapturedReactivityData } from "./reaction";
import { createContextId, Scope, type ContextId } from "./scope";
import type { TaskCallback } from "./task";

export type CapturedTaskData = {
  task: TaskCallback,
  reactivityData: CapturedReactivityData,
  parentScope: Scope | null,
};
export type CapturedAsyncTaskData = {
  task: AsyncTaskCallback,
  capture: () => CapturedReactivityData,
  promise: PromiseLike<void>,
  parentScope: Scope | null,
};
export type TaskCaptureData = {
  capturedTasks: CapturedTaskData[],
  capturedAsyncTasks: CapturedAsyncTaskData[],
};
export const taskCaptureContextId: ContextId<TaskCaptureData> = createContextId<TaskCaptureData>("__lentjs_taskCaptureData", { noSerialize: true });
