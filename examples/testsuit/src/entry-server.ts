import type { Connect } from "vite";
import App from "./app";
import { renderToString } from "@lentjs/core";

export function render(req: Connect.IncomingMessage): string {
  const url = new URL(`http://localhost${req.url}`);
  if (url.searchParams.get("no-ssr") != null)
    return "";
  try {
    return renderToString(App);
  }
  catch(e) {
    console.error(e);
    return e instanceof Error ? e.toString() : "";
  }
}
