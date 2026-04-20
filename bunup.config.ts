import { defineWorkspace } from "bunup";

export default defineWorkspace(
  [
    {
      name: "core",
      root: "packages/core",
      config: {
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
      },
    },
    {
      name: "core-reactivity",
      root: "packages/core-reactivity",
    },
    {
      name: "core-serialize",
      root: "packages/core-serialize",
    },
    {
      name: "utils",
      root: "packages/utils",
    },
    {
      name: "vitejs-plugin",
      root: "packages/vitejs-plugin",
    }
  ],
  {
    format: ["esm", "cjs"],
    exports: true,
  },
);
