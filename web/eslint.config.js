import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: "detect" } },
    rules: {
      "react/no-danger": "error",
      "react/prop-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Só shared/api/http.ts pode chamar fetch (ver o override abaixo).
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use o cliente http de shared/api/http.ts." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "fetch",
          message: "Use o cliente http de shared/api/http.ts.",
        },
        {
          object: "globalThis",
          property: "fetch",
          message: "Use o cliente http de shared/api/http.ts.",
        },
      ],
    },
  },
  {
    files: ["src/shared/api/http.ts"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  {
    files: ["*.config.{js,ts}", "vite.config.ts", "**/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
  },
);
