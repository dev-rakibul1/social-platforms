import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Template/vendor assets (keep Bootstrap as-is).
    "public/**",
    "**/*.min.js",
  ]),
  {
    rules: {
      // The UI must keep the provided Bootstrap HTML structure which uses <img>.
      "@next/next/no-img-element": "off",
      // Some template DOM-interop code uses `any`; warn but don't fail CI.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
