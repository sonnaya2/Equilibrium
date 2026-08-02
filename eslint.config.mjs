import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Lean Next + TS lint for CI:
 * - unused imports/vars
 * - classic React hooks mistakes
 * - no broad style churn
 *
 * React Compiler-style rules (set-state-in-effect, immutability) stay off until
 * the map/tasks clients can be migrated without a rewrite.
 */
const config = [
  {
    ignores: [
      ".next/**",
      // Sibling git worktrees carry their own .next output; without this, a
      // local lint run reports thousands of errors from generated bundles.
      ".claude/worktrees/**",
      "node_modules/**",
      "dist/**",
      "public/**",
      "assets/**",
      "data/**",
      // Asset/map tooling stays ignored; critical data platform scripts are
      // re-included below for unused-vars and no-undef checks.
      "scripts/**",
      "!scripts/data/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "tools/_refactor_*.mjs",
      "tools/_TaskRecords.orig.tsx",
      // Local scratch / generated icon helpers (not product).
      ".asset-cache/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 3 },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Compiler-era rules: correct intent, too noisy for this codebase today.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/incompatible-library": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Node .mjs data platform — catch unused vars / undefined globals without
    // forcing a TypeScript migration of the whole pipeline.
    files: ["scripts/data/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        structuredClone: "readonly",
        performance: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "writable",
      },
      sourceType: "module",
      ecmaVersion: 2024,
    },
    rules: {
      // CLI entrypoints log status intentionally.
      "no-console": "off",
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Next/TS rules are irrelevant for Node scripts.
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/rules-of-hooks": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default config;
