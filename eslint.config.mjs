import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable known false-positive rule from React Compiler ESLint plugin.
  // See: https://github.com/facebook/react/issues/34905
  // The rule incorrectly flags setState after `await` as synchronous.
  // Re-enable once babel-plugin-react-compiler ships the fix (PR #35732).
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // External/vendor workspace copied under panel for tooling experiments.
    // Not part of the panel product surface or quality gate.
    "chrome-devtools-mcp/**",
  ]),
]);

export default eslintConfig;
