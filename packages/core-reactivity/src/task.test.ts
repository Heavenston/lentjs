import { describe, expect, test, jest } from "bun:test";
import { createTask, resumeTask } from "./task";
import { createSignal } from "./signal";
import { startReaction } from "./reaction";
import { Scope } from "./scope";
import { taskCaptureContextId, type TaskCaptureData } from "./task-capture";

function createTaskCaptureData(): TaskCaptureData {
  return { capturedTasks: [], capturedAsyncTasks: [] };
}

describe("createTask", () => {
  test("runs the task callback immediately", () => {
    const task = jest.fn();
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("re-runs when a read signal changes", () => {
    const [accessor, setter] = createSignal(0);
    const task = jest.fn(() => { accessor(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    setter(1);
    expect(task).toHaveBeenCalledTimes(2);
    cleanup();
  });

  test("does not re-run when signal set to same value", () => {
    const [accessor, setter] = createSignal(5);
    const task = jest.fn(() => { accessor(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    setter(5);
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("cleans up reaction when parent scope cleans", () => {
    const [accessor, setter] = createSignal(0);
    const task = jest.fn(() => { accessor(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
    setter(1);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("works without a parent scope", () => {
    const task = jest.fn();
    expect(() => createTask(task)).not.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("creates a new scope for each run", () => {
    const [accessor, setter] = createSignal(0);
    const scopes: (Scope | null)[] = [];
    const task = () => {
      accessor();
      scopes.push(Scope.currentScope);
    };
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    setter(1);
    expect(scopes).toBeArrayOfSize(2);
    expect(scopes[0]).not.toBeNull();
    expect(scopes[1]).not.toBeNull();
    expect(scopes[0]).not.toBe(scopes[1]);
    cleanup();
  });

  test("previous run's scope is cleaned when task re-runs", () => {
    const [accessor, setter] = createSignal(0);
    const scopes: (Scope | null)[] = [];
    const task = () => {
      accessor();
      scopes.push(Scope.currentScope);
    };
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => createTask(task));
    setter(1);
    expect(scopes[0]!.state).toBe("cleaned");
    expect(scopes[1]!.state).toBe("alive");
    cleanup();
  });
});

describe("createTask with capture context", () => {
  test("pushes captured data into taskCaptureData.capturedTasks", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const task = jest.fn();
    scope.enter(() => createTask(task));
    expect(captureData.capturedTasks).toBeArrayOfSize(1);
    cleanup();
  });

  test("captured task has the task callback, reactivityData, and parentScope", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const task = jest.fn();
    scope.enter(() => createTask(task));
    const captured = captureData.capturedTasks[0]!;
    expect(captured.task).toBe(task);
    expect(captured.parentScope).toBe(scope);
    expect(captured.reactivityData).toBeDefined();
    cleanup();
  });

  test("task is run once during capture", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const task = jest.fn();
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("task is NOT re-run when a read signal changes while capturing", () => {
    const [accessor, setter] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    const task = jest.fn(() => { accessor(); });
    scope.enter(() => createTask(task));
    expect(task).toHaveBeenCalledTimes(1);
    setter(1);
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("captured reactivityData reflects the signals read", () => {
    const [accessor] = createSignal(0);
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    scope.enter(() => createTask(() => { accessor(); }));
    expect(captureData.capturedTasks[0]!.reactivityData.length).toBe(1);
    cleanup();
  });

  test("parent cleanup removes captured data from the array", () => {
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    scope.enter(() => createTask(() => {}));
    expect(captureData.capturedTasks).toBeArrayOfSize(1);
    cleanup();
    expect(captureData.capturedTasks).toBeArrayOfSize(0);
  });

  test("asserts if called via resumeTask during capture", () => {
    const [accessor] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const [scope, cleanup] = Scope.createControlled();
    const captureData = createTaskCaptureData();
    scope.setContext(taskCaptureContextId, captureData);
    expect(() => {
      scope.enter(() => resumeTask(() => {}, reactivityData));
    }).toThrow("Cannot resume a task while capturing tasks");
    cleanup();
  });
});

describe("resumeTask", () => {
  test("does not run task immediately", () => {
    const [accessor] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const task = jest.fn(() => { accessor(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => resumeTask(task, reactivityData));
    expect(task).toHaveBeenCalledTimes(0);
    cleanup();
  });

  test("runs task when a resumed signal triggers", () => {
    const [accessor, setter] = createSignal(0);
    const [, reactivityData] = startReaction(() => accessor());
    const task = jest.fn(() => { accessor(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => resumeTask(task, reactivityData));
    expect(task).toHaveBeenCalledTimes(0);
    setter(1);
    expect(task).toHaveBeenCalledTimes(1);
    cleanup();
  });

  test("after first trigger, re-tracks signals normally", () => {
    const [accessor1, setter1] = createSignal(0);
    const [accessor2, setter2] = createSignal(0);
    // Resume with accessor1 tracked
    const [, reactivityData] = startReaction(() => accessor1());
    // But the task reads accessor2
    const task = jest.fn(() => { accessor2(); });
    const [scope, cleanup] = Scope.createControlled();
    scope.enter(() => resumeTask(task, reactivityData));

    // Trigger via accessor1
    setter1(1);
    expect(task).toHaveBeenCalledTimes(1);

    // Now accessor2 should be tracked
    setter2(1);
    expect(task).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
