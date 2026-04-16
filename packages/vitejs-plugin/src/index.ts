import { type PluginOption } from "vite";
import { transform } from "@swc/core";
import { fileURLToPath } from "node:url";

function compilePlugin(): PluginOption {
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

function randomIdPlugin(): PluginOption {
  return {
    name: "lentjs-vitejs-random-id",
    transform: {
      filter: {
        code: /____RANDOM_ID/,
      },
      async handler(code, id) {
        function toBase64(arr: Uint8Array): string {
          return (arr as any).toBase64();
        }
        const prefix = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(`${id}\n${code}`)))).replace(/[+/=]/g, "").slice(0,16);
        let i = 0;
        const newId = () => i++;
        return {
          code: code.replace(/____RANDOM_ID/g, () => `${prefix}_${newId().toString(16).padStart(2, "0")}`),
        };
      },
    },
  };
}

export default function LentjsVitejsPlugin(): PluginOption {
  return [
    compilePlugin(),
    randomIdPlugin(),
  ];
};
