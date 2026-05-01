import { describe, expect, test, jest } from "bun:test";
import { createAsyncTask, resumeAsyncTask, type AsyncTaskContext } from "./async-task";
import { createSignal } from "./signal";
import { startReaction } from "./reaction";
import { Scope } from "./scope";
import { taskCaptureContextId, type TaskCaptureData } from "./task-capture";

function createTaskCaptureData(): TaskCaptureData {
  return { capturedTasks: [], capturedAsyncTasks: [] };
}

function resolved(): PromiseLike<void> {
  return Promise.resolve();
}

describe("createAsyncTask", () => {
  test("calls the async task callback with ctx containing track and scope", () => {
    const [scope, cleanup] = Scope.createControlled();
    let receivedCtx: AsyncTaskContext | null = null;
    scope.enter(() => createAsyncTask((ctx) => {
      receivedCtx = ctx;
      return resolved();
    }));
    expect(receivedCtx).not.toBeNull();
    expect(typeof receivedCtx!.track).toBe("function");
    expect(receivedCtx!.scope).toBeInstanceOf(Scope);
    cleanup();
  });

  test("task callback runs with Scope.currentScope as null", () => {
    const [scope, cleanup] = Scope.createControlled();
    let currentScopeDuringTask: Scope | null | undefined = undefined;
    scope.enter(() => createAsyncTask(() => {
      currentScopeDuringTask = Scope.currentScope;
      return resolved();
    }));
    expect(currentScopeDuringTask).toBeNull();
    cleanup();
  });

  test("ctx.scope is parented to the calling scope", () => {
    const [scope, cleanup] = Scope.createControlled();
    let ctxScope: Scope | null = null;
    scope.enter(() => createAsyncTask((ctx) => {
      ctxScope = ctx.scope;
      return resolved();
    }));
    expect(ctxScope!.parent).toBe(scope);
    cleanup();
  });

  test("track returns the inner callback's value", () => {
    const [scope, cleanup] = Scope.createControlled();
    let trackResult: number | null = null;
    scope.enter(() => createAsyncTask((ctx) => {
      trackResult = ctx.track(() => 42);
      return resolved();
    }));
    expect(trackResult!).toBe(42);
    cleanup();
  });

  test("re-runs entire async task when a tracked signal changes", () => {
    const [accessor, setter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor());
      return resolved();
    });
    scope.enter(() => createAsyncTask(taskFn));
    expect(taskFn).toHaveBeenCalledTimes(1);
    setter(1);
    expect(taskFn).toHaveBeenCalledTimes(2);
    cleanup();
  });

  test("does not re-run for untracked signal changes", () => {
    const [, unrelatedSetter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn(() => {
      return resolved();
    });
    scope.enter(() => createAsyncTask(taskFn));
    expect(taskFn).toHaveBeenCalledTimes(1);
    unrelatedSetter(99);
    expect(taskFn).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("cleans previous run's scope when re-running", () => {
    const [accessor, setter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const scopes: Scope[] = [];
    scope.enter(() => createAsyncTask((ctx) => {
      ctx.track(() => accessor());
      scopes.push(ctx.scope);
      return resolved();
    }));
    setter(1);
    expect(scopes).toBeArrayOfSize(2);
    expect(scopes[0]!.state).toBe("cleaned");
    expect(scopes[1]!.state).toBe("alive");
    cleanup();
  });

  test("cleans up when parent scope cleans", () => {
    const [accessor, setter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor());
      return resolved();
    });
    scope.enter(() => createAsyncTask(taskFn));
    expect(taskFn).toHaveBeenCalledTimes(1);
    cleanup();
    setter(1);
    expect(taskFn).toHaveBeenCalledTimes(1);
  });

  test("works without a parent scope", () => {
    const taskFn = jest.fn(() => resolved());
    expect(() => createAsyncTask(taskFn)).not.toThrow();
    expect(taskFn).toHaveBeenCalledTimes(1);
  });
});

describe("createAsyncTask track", () => {
  test("accumulates reactivity across multiple track calls", () => {
    const [accessor1, setter1] = createSignal(0);
    const [accessor2, setter2] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor1());
      ctx.track(() => accessor2());
      return resolved();
    });
    scope.enter(() => createAsyncTask(taskFn));
    expect(taskFn).toHaveBeenCalledTimes(1);

    // Either signal should trigger re-run
    setter1(1);
    expect(taskFn).toHaveBeenCalledTimes(2);

    setter2(1);
    expect(taskFn).toHaveBeenCalledTimes(3);
    cleanup();
  });

  test("throws if scope is already cleaned", () => {
    const [scope, cleanup] = Scope.createControlled();
    let savedCtx: AsyncTaskContext | null = null;
    scope.enter(() => createAsyncTask((ctx) => {
      savedCtx = ctx;
      return resolved();
    }));
    cleanup();
    expect(() => savedCtx!.track(() => {})).toThrow("Cannot call an async task's track after it has been cleaned");
  });
});

describe("createAsyncTask with capture context", () => {
  test("pushes captured data into taskCaptureData.capturedAsyncTasks", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    scope.enter(() => createAsyncTask(() => resolved()));
    expect(captureData.capturedAsyncTasks).toBeArrayOfSize(1);
    cleanup();
  });

  test("captured data includes task, capture fn, promise, parentScope", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const taskFn = () => resolved();
    scope.enter(() => createAsyncTask(taskFn));
    const captured = captureData.capturedAsyncTasks[0]!;
    expect(captured.task).toBe(taskFn);
    expect(captured.parentScope).toBe(scope);
    expect(typeof captured.capture).toBe("function");
    expect(captured.promise).toBeDefined();
    cleanup();
  });

  test("task is NOT re-run when a tracked signal changes while capturing", () => {
    const [accessor, setter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor());
      return resolved();
    });
    scope.enter(() => createAsyncTask(taskFn));
    expect(taskFn).toHaveBeenCalledTimes(1);
    setter(1);
    expect(taskFn).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("capture() returns accumulated reactivity data", () => {
    const [accessor] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    scope.enter(() => createAsyncTask((ctx) => {
      ctx.track(() => accessor());
      return resolved();
    }));
    const captured = captureData.capturedAsyncTasks[0]!;
    const reactivityData = captured.capture();
    expect(reactivityData.length).toBe(1);
    cleanup();
  });

  test("capture() cleans up the scope", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    let ctxScope: Scope | null = null;
    scope.enter(() => createAsyncTask((ctx) => {
      ctxScope = ctx.scope;
      return resolved();
    }));
    const captured = captureData.capturedAsyncTasks[0]!;
    expect(ctxScope!.state).not.toBe("cleaned");
    captured.capture();
    expect(ctxScope!.state).toBe("cleaned");
    cleanup();
  });

  test("asserts if called via resumeAsyncTask during capture", () => {
    const [accessor] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    expect(() => {
      scope.enter(() => resumeAsyncTask(() => resolved(), reactivityData));
    }).toThrow("Cannot resume an async task while capturing tasks");
    cleanup();
  });

  test("track still works during capture and accumulates data", () => {
    const [accessor1] = createSignal(0);
    const [accessor2] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    scope.enter(() => createAsyncTask((ctx) => {
      ctx.track(() => accessor1());
      ctx.track(() => accessor2());
      return resolved();
    }));
    const captured = captureData.capturedAsyncTasks[0]!;
    const reactivityData = captured.capture();
    expect(reactivityData.length).toBe(2);
    cleanup();
  });
});

describe("resumeAsyncTask", () => {
  test("does not run task immediately", () => {
    const [accessor] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn(() => resolved());
    scope.enter(() => resumeAsyncTask(taskFn, reactivityData));
    expect(taskFn).toHaveBeenCalledTimes(0);
    cleanup();
  });

  test("runs task when a resumed signal triggers", () => {
    const [accessor, setter] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const [scope, cleanup] = Scope.createControlled();
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor());
      return resolved();
    });
    scope.enter(() => resumeAsyncTask(taskFn, reactivityData));
    expect(taskFn).toHaveBeenCalledTimes(0);
    setter(1);
    expect(taskFn).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("after first trigger, re-tracks signals normally", () => {
    const [accessor1, setter1] = createSignal(0);
    const [accessor2, setter2] = createSignal(0);
    // Resume with accessor1 tracked
    const [, reactivityData] = startReaction(() => accessor1());
    const [scope, cleanup] = Scope.createControlled();
    // But the task tracks accessor2
    const taskFn = jest.fn((ctx: AsyncTaskContext) => {
      ctx.track(() => accessor2());
      return resolved();
    });
    scope.enter(() => resumeAsyncTask(taskFn, reactivityData));

    // Trigger via accessor1
    setter1(1);
    expect(taskFn).toHaveBeenCalledTimes(1);

    // Now accessor2 should be tracked
    setter2(1);
    expect(taskFn).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
