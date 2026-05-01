import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: [
      "**/*.{js,mjs,cjs,ts,mts,cts}",
    ],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: {...globals.browser, ...globals.node} },
  },
  tseslint.configs.recommendedTypeChecked,
  // tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Usefull features that are only usefull as lints for legacy code bases (imo)
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      // Cannot enable this because we use typescript's isolatedDeclarations
      "@typescript-eslint/no-inferrable-types": "off",
      // Do not agree with these stylistic rules
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-non-null-assertion": "off",

      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-indexed-object-style": ["error", "index-signature"],

      "@typescript-eslint/restrict-template-expressions": ["error", {
        allow: [
          { from: "package", package: "@lentjs/core-reactivity", name: "ContextId" },
          { from: "file", name: "ContextId" },
        ],
      }],
    },
  },
]);
