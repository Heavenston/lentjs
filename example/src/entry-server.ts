import App from "./app";
import { renderToString } from "lent";

export function render(req: Request): string {
  console.log(req);
  return renderToString(App);
}
