// import "./app";
// import { startRuntime } from "@lentjs/core";

// console.log("Client entry point");
// const el = document.getElementById("app");
// startRuntime(el!);

import App from "./app";
import { renderToDom } from "@lentjs/core";

console.log("Client entry point");
const el = document.getElementById("app");
renderToDom(el!, App);
