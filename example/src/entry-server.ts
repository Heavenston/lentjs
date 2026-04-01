import App from "./app";
import { h, renderToString } from "lent";

export function render(_req: Request): string {
  return renderToString(h(App));
}
