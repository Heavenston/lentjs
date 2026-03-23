
export function jsxDEV(element: any, props: any) {
  if (typeof element === "string") {
    const el = document.createElement(element);
    for (const [k, v] of Object.entries(props))
      el.setAttribute(k, v as any);
    return el;
  }
  return new element(props).render();
}
