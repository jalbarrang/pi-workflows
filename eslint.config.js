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
      "no-restricted-syntax": [
        "error",
        {
          selector: "ObjectExpression > SpreadElement > ConditionalExpression",
          message:
            "No conditional spread. Build the object explicitly, or assign the optional field after.",
        },
        {
          selector: "ObjectExpression > SpreadElement > LogicalExpression",
          message: "No `...(cond && {...})`. Build the object explicitly.",
        },
      ],
    },
  },
];
