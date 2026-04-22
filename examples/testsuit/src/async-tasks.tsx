import { assert, createAsyncTask, createSignal, register$, type ComponentFn } from "@lentjs/core";

export default register$<ComponentFn<{}>>(() => {
  const [trigger, setTrigger] = createSignal("initial");
  const [value, setValue] = createSignal("starting task...");

  createAsyncTask(async ({ track, scope }) => {
    console.log("Start of async task");
    const triggerValue = track(trigger);

    const targetDuration = typeof document === "undefined" ? 100 : 1000;
    const startT = performance.now();

    setValue("Start of task...");
    for (let i = 1; i < triggerValue.length && !scope.cleaned; i++) {
      setValue(`${performance.now() - startT}: ${triggerValue.slice(0, i)}`);

      const remainingT = targetDuration - (performance.now() - startT);
      const waitPerEl = Math.floor(remainingT / (triggerValue.length - i));
      if (waitPerEl > 0)
        await new Promise(res => setTimeout(res, waitPerEl));
    }
    if (scope.cleaned) return;
    setValue(`${Math.trunc(performance.now() - startT)}: ${triggerValue}!`);
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
