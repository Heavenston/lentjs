import App from "./app";
import { renderToString } from "lent";

export function render(_req: Request): string {
  return renderToString(App);
}
