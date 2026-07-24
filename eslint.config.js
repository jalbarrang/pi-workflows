import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/**", "pnpm-lock.yaml"],
  },
  {
    files: ["**/*.{ts,js,cjs,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      "max-lines": ["error", { max: 100, skipBlankLines: false, skipComments: false }],
    },
  },
];
