import { fileURLToPath, URL } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const serverDirectory = fileURLToPath(new URL("./server/", import.meta.url));
const compat = new FlatCompat({
  baseDirectory: serverDirectory,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  {
    ...js.configs.recommended,
    files: ["eslint.config.mjs"],
  },
  ...compat
    .config({
      extends: [
        "airbnb-base",
        "plugin:@typescript-eslint/recommended",
        "plugin:security/recommended",
        "eslint:recommended",
        "plugin:node/recommended",
        "prettier",
        "plugin:prettier/recommended",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2017,
        project: ["tsconfig.test.json"],
        sourceType: "module",
        tsconfigRootDir: serverDirectory,
      },
      plugins: ["@typescript-eslint", "security"],
      rules: {
        "max-len": ["error", { code: 128 }],
        "import/extensions": "off",
        // The base rule misreports TS type signatures; the TS-aware one covers it.
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "node/no-missing-import": "off",
        "react/jsx-filename-extension": "off",
        "node/file-extension-in-import": "off",
        "node/no-unsupported-features/es-syntax": "off",
        "node/exports-style": ["error", "module.exports"],
        "node/prefer-global/buffer": ["error", "always"],
        "node/prefer-global/console": ["error", "always"],
        "node/prefer-global/process": ["error", "always"],
        "node/prefer-global/url-search-params": ["error", "always"],
        "node/prefer-global/url": ["error", "always"],
        "node/prefer-promises/dns": "error",
        "node/prefer-promises/fs": "error",
      },
      settings: {
        "import/resolver": {
          typescript: {
            project: fileURLToPath(
              new URL("./server/tsconfig.test.json", import.meta.url)
            ),
          },
          node: {
            extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
            tryExtensions: [".js", ".json", ".node", ".ts", ".d.ts"],
            moduleDirectory: ["node_modules", "src"],
          },
        },
      },
    })
    .concat(
      compat.config({
        overrides: [
          {
            // Tests and the test harness may use dev dependencies (vitest, supertest).
            files: ["**/*.test.ts", "src/test/**/*.ts"],
            rules: {
              "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
              "node/no-unpublished-import": "off",
            },
          },
        ],
      }),
    )
    .map((config) => ({
      ...config,
      files: config.files
        ? config.files.map((pattern) => ["server/src/**/*.ts", pattern])
        : ["server/src/**/*.ts"],
    })),
];
