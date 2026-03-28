
function run(n: Node) {
  if (n instanceof Comment) {
    console.log(n);
  }
  if (n instanceof HTMLElement) {
    console.log(n);
  }
  n.childNodes.forEach(run);
}

export function startRuntime(rootElement: HTMLElement) {
  console.time("startRuntime");
  run(rootElement);
  console.timeEnd("startRuntime");
}

