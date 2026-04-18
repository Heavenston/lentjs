import { type PluginOption } from "vite";
import { compilePlugin } from "./compile-plugin";
import { randomIdPlugin } from "./random-id-plugin";

export type LentjsVitejsPluginConfig = {
  
};

export default function LentjsVitejsPlugin(_cfg: LentjsVitejsPluginConfig = {}): PluginOption {
  return [
    compilePlugin(),
    randomIdPlugin(),
  ];
};
