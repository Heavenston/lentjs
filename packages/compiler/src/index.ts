import { type Plugin } from "vite";

export const lentjsCompilerPlugin = (): Plugin => {
  return {
    name: "lentjs-compiler",

    transform: {
      filter: {
        moduleType: ["jsx", "tsx"],
      },

      handler(code, id, options) {
        console.log("Transform!!", id);
          
        return { code };
      },
    },
  };
};
