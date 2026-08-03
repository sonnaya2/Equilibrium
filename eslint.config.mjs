import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Next + TS lint: unused vars, hooks rules. Compiler-era rules off until map/tasks migrate.
 */
const config = [
  {
    ignores: [
      ".next/**",
      // Sibling checkouts / local worktrees can carry their own .next output.
      "worktrees/**",
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
  // Combat layer boundaries (mirrors scripts/architecture/check.mjs).
  // packRequest.ts: legacy debt; shared->engine enforced by architecture script only.
  {
    files: ["src/combat/**/*.{ts,tsx}"],
    ignores: [
      "src/combat/**/*.test.ts",
      "src/combat/**/*.test.tsx",
      "src/combat/solver/packRequest.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components",
              message: "src/combat must not import UI components (architecture boundary).",
            },
          ],
          patterns: [
            {
              group: ["@/components/*", "src/components", "src/components/*"],
              message: "src/combat must not import UI components (architecture boundary).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/combat/solver/**/*.{ts,tsx}"],
    ignores: ["src/combat/solver/**/*.test.ts", "src/combat/solver/packRequest.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "src/combat/solver must stay free of react (architecture boundary).",
            },
            {
              name: "react-dom",
              message: "src/combat/solver must stay free of react-dom (architecture boundary).",
            },
            {
              name: "@/components",
              message: "src/combat/solver must not import UI components (architecture boundary).",
            },
          ],
          patterns: [
            {
              group: [
                "react/*",
                "react-dom/*",
                "@/components/*",
                "src/components",
                "src/components/*",
              ],
              message: "src/combat/solver must not import react or UI components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/combat/engine/**/*.{ts,tsx}"],
    ignores: ["src/combat/engine/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components",
              message: "src/combat/engine must not import UI components (architecture boundary).",
            },
          ],
          patterns: [
            {
              group: ["@/components/*", "src/components", "src/components/*"],
              message: "src/combat/engine must not import UI components (architecture boundary).",
            },
          ],
        },
      ],
    },
  },
  {
    // Node data-platform scripts: no-undef / unused-vars without TS migration.
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
