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
    // Next.js build output (root and subdirs)
    ".next/**",
    "panel/.next/**",
    "portal/.next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // node_modules in subdirectories
    "panel/node_modules/**",
    "portal/node_modules/**",
    // Non-product directories
    "chrome-devtools-mcp/**",
    "panel/chrome-devtools-mcp/**",
    "panel/pdf-renders/**",
    "panel/pdf-check-current/**",
    "panel/pdf-verification/**",
    // Portal source (separate project, separate lint)
    "portal/**",
    // Test infrastructure
    "e2e/**",
  ]),
]);

export default eslintConfig;
