import "./app";
import App from "./app";
import { renderToDom, startRuntime } from "@lentjs/core";

console.log("Client entry point");
const el = document.getElementById("app")!;
if (el.innerText.trim() === "") {
  console.log("Using client side rendering");
  renderToDom(el, App);
}
else {
  startRuntime(el!);
}
