import { type Plugin } from "vite";
import { transform } from "@swc/core";

export const lentjsCompilerPlugin = (): Plugin => {
  return {
    name: "lentjs-compiler",

    transform: {
      filter: {
        id: /^[^\0].*\.(?:ts|js|tsx|jsx)$/,
        moduleType: ["jsx", "tsx", "js", "ts"],
      },

      async handler(code, id, options) {
        if (!options) throw new Error("Missing options");
        console.log("Transform!!", id, options);

        const output = await transform(code, {
          filename: id,
          swcrc: false,
          configFile: false,
          sourceMaps: true,
          minify: true,
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
};
