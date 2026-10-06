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
      env: {
        "jest/globals": true,
      },
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
        project: ["tsconfig.json"],
        sourceType: "module",
        tsconfigRootDir: serverDirectory,
      },
      plugins: ["@typescript-eslint", "jest", "security"],
      rules: {
        "max-len": ["error", { code: 128 }],
        "import/extensions": "off",
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
              new URL("./server/tsconfig.json", import.meta.url)
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
    .map((config) => ({
      ...config,
      files: config.files
        ? config.files.map((pattern) => ["server/src/**/*.ts", pattern])
        : ["server/src/**/*.ts"],
    })),
];
