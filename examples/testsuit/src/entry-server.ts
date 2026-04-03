import App from "./app";
import { h, renderToString } from "@lentjs/core";

export function render(_req: Request): string {
  return renderToString(h(App));
}
