import { assert, createAsyncTask, createSignal, register$, type ComponentFn } from "@lentjs/core";

export default register$<ComponentFn<{}>>(() => {
  const [trigger, setTrigger] = createSignal("initial");
  const [value, setValue] = createSignal("starting task...");

  createAsyncTask(async ({ track, scope }) => {
    console.log("Start of async task");
    const triggerValue = track(trigger);
    setValue("Start of task...");
    for (let i = 1; i < triggerValue.length && !scope.cleaned; i++) {
      setValue(triggerValue.slice(0, i));
      await new Promise(res => setTimeout(res, 10));
    }
    if (scope.cleaned) return;
    setValue(`${triggerValue}!`);
  });

  return <>
    <div><input value={trigger()} on:input={e => {
      assert(e.currentTarget instanceof HTMLInputElement);
      console.log(`Changing trigger to ${e.currentTarget.value}`);
      setTrigger(e.currentTarget.value);
    }} /></div>
    <div><span attr:style="color: gray;">Value: </span>{value()}</div>
  </>;
});
