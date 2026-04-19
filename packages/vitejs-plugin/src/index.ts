import { type PluginOption } from "vite";
import { compilePlugin } from "./compile-plugin.js";
import { randomIdPlugin } from "./random-id-plugin.js";

export type LentjsVitejsPluginConfig = {
  
};

export default function LentjsVitejsPlugin(_cfg: LentjsVitejsPluginConfig = {}): PluginOption {
  return [
    compilePlugin(),
    randomIdPlugin(),
  ];
};
