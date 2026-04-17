import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.generated/**",
      "**/generated/**",
      "lib/api-zod/src/generated/**",
      "lib/api-client-react/src/generated/**",
      // Skill scaffolding templates — not part of the workspace build
      ".local/**",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Global settings
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      // Relax rules that conflict with existing codebase patterns
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-require-imports": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // JSX a11y + react-hooks rules for React code
  {
    files: ["artifacts/cyfy-news/src/**/*.{ts,tsx,jsx}"],
    plugins: { "jsx-a11y": jsxA11y, "react-hooks": reactHooks },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // shadcn-style wrapper components spread {...props} and receive children
      // from callers. Treat these as warnings rather than errors.
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      "jsx-a11y/label-has-associated-control": [
        "warn",
        { assert: "either", depth: 5 },
      ],
      // Many existing components pass children via props; prefer warn over error.
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      // The existing codebase uses intentional effect-deps patterns throughout.
      // Surface exhaustive-deps as a warning rather than an error.
      "react-hooks/exhaustive-deps": "warn",
      // React-compiler-era rules are too strict for the existing codebase;
      // downgrade to warnings so lint stays actionable.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/capitalized-calls": "warn",
      "react-hooks/no-deriving-state-in-effects": "warn",
    },
  },
);
