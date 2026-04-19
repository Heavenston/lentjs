import { type PluginOption } from "vite";
import { compilePlugin } from "./compile-plugin.js";
import { randomIdPlugin } from "./random-id-plugin.js";
import { ssrPlugin } from "./ssr-plugin.js";

export type LentjsVitejsPluginConfig = {
  disableSSR?: boolean,
};

export default function LentjsVitejsPlugin(cfg: LentjsVitejsPluginConfig = {}): PluginOption {
  return [
    compilePlugin(),
    randomIdPlugin(),
    cfg.disableSSR ? [] : [ssrPlugin()],
  ];
};
