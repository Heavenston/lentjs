import { defineConfig } from "bunup";

export default defineConfig({
  format: ["esm", "cjs"],
  exports: {
    customExports: () => ({
      "./jsx-runtime": {
        "import": {
          "types": "./jsx-runtime.d.ts",
          "import": "./jsx-runtime.d.ts"
        }
      },
      "./jsx-dev-runtime": {
        "import": {
          "types": "./jsx-dev-runtime.d.ts",
          "import": "./jsx-dev-runtime.d.ts"
        }
      },
    }),
  },
});
