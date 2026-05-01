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
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    rules: {
      // Usefull features that are only usefull as lints for legacy code bases (i think)
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-this-alias": "off",
      // Cannot enable this because we use typescript's isolatedDeclarations
      "@typescript-eslint/no-inferrable-types": "off",
      // Do not agree with this style
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "off",

      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-indexed-object-style": ["error", "index-signature"],
    },
  },
]);
