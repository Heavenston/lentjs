import { assert, noop } from "@lentjs/utils";
import { combineReactivityData, EMPTY_REACTIVITY_DATA, resumeReaction, startReaction, type CapturedReactivityData, type UnsubscribeReaction } from "./reaction";
import { Scope } from "./scope";
import { taskCaptureContextId } from "./task-capture";

export type AsyncTaskTrack = <T>(cb: () => T) => T;
export type AsyncTaskContext = {
  track: AsyncTaskTrack,
  scope: Scope,
};
export type AsyncTaskCallback = (ctx: AsyncTaskContext) => PromiseLike<void>;

function internalCreateOrResumeAsyncTask(task: AsyncTaskCallback, resumeWithReactivityData: CapturedReactivityData | null) {
  const parentScope = Scope.currentScope;
  const asyncTaskCaptureData = parentScope?.tryGetContext(taskCaptureContextId) ?? null;

  let previousCleanup = noop;
  const startTask = () => {
    previousCleanup();
    const [scope, cleanupScope] = Scope.createControlled(parentScope);
    previousCleanup = cleanupScope;

    let accumulatedReactivityData = EMPTY_REACTIVITY_DATA;
    let currentReactivityUnsub: UnsubscribeReaction | null = null;

    scope.onCleanup(() => {
      currentReactivityUnsub?.();
    });

    const ctx: AsyncTaskContext = {
      track: <T>(cb: () => T): T => {
        assert(scope.state !== "cleaned", "Cannot call an async task's track after it has been cleaned");
        const [val, newReactivityData] = startReaction(cb);
        accumulatedReactivityData = combineReactivityData(accumulatedReactivityData, newReactivityData);
        currentReactivityUnsub?.();
        currentReactivityUnsub = resumeReaction(startTask, accumulatedReactivityData);
        return val;
      },
      scope,
    };
    // Entering a null scope because an async function should not attempt to get the current scope
    Scope.enter(null, task, ctx);
  };

  if (asyncTaskCaptureData) {
    assert(resumeWithReactivityData === null, "Cannot resume an async task while capturing tasks");

    const [scope, cleanupScope] = Scope.createControlled(parentScope);

    let accumulatedReactivityData = EMPTY_REACTIVITY_DATA;
    const ctx: AsyncTaskContext = {
      track: <T>(cb: () => T): T => {
        assert(scope.state !== "cleaned", "Cannot call an async task's track after it has been cleaned");
        const [val, newReactivityData] = startReaction(cb);
        accumulatedReactivityData = combineReactivityData(accumulatedReactivityData, newReactivityData);
        return val;
      },
      scope,
    };
    const promise = Scope.enter(null, task, ctx);
    asyncTaskCaptureData?.capturedAsyncTasks.push({
      task,
      capture: (): CapturedReactivityData => {
        cleanupScope();
        return accumulatedReactivityData;
      },
      promise,
      parentScope,
    });
  }
  else {
    if (resumeWithReactivityData) {
      const unsub = resumeReaction(startTask, resumeWithReactivityData);
      parentScope?.onCleanup(unsub);
    }
    else {
      startTask();
    }
  }
}

export function createAsyncTask(task: AsyncTaskCallback): void {
  internalCreateOrResumeAsyncTask(task, null);
}

export function resumeAsyncTask(task: AsyncTaskCallback, reactivityData: CapturedReactivityData): void {
  internalCreateOrResumeAsyncTask(task, reactivityData);
}

