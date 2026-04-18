import { type PluginOption } from "vite";
import { transform } from "@swc/core";
import { fileURLToPath } from "node:url";

export function compilePlugin(): PluginOption {
  return {
    name: "lentjs-vitejs",

    transform: {
      filter: {
        id: /^[^\0].*\.(?:ts|js|tsx|jsx)$/,
        moduleType: ["jsx", "tsx", "js", "ts"],
      },

      async handler(code, id, options) {
        if (!options) throw new Error("Missing options");

        const output = await transform(code, {
          filename: id,
          swcrc: false,
          configFile: false,
          sourceMaps: true,
          minify: false,
          jsc: {
            target: "es2022",
            parser: options.moduleType.startsWith("ts")
              ? {
                syntax: "typescript",
                tsx: options.moduleType.endsWith("x"),
              }
              : {
                syntax: "ecmascript",
                jsx: options.moduleType.endsWith("x"),
              },
            transform: {
              react: {
                runtime: "preserve",
                throwIfNamespace: false,
              },
            },
            experimental: {
              plugins: [
                [fileURLToPath(import.meta.resolve("@lentjs/swc-plugin")), { }]
              ],
            },
          },
        });

        return {
          code: output.code,
          moduleType: "js",
          map: output.map,
        };
      },
    },
  };
}
