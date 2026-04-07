import App from "./app";
import { renderToString } from "@lentjs/core";

export function render(_req: Request): string {
  if (true as unknown)
    return "";
  try {
    return renderToString(App);
  }
  catch(e) {
    console.error(e);
    return e instanceof Error ? e.toString() : "";
  }
}
