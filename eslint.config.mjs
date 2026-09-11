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
    // Erzeugnisse der Browsertests. Sie stehen zwar in .gitignore, aber die
    // liest ESLint im Flat-Config-Format nicht — ohne diese Zeilen lintet er
    // den mitgelieferten Berichts-Bundle und meldet dreitausend Probleme in
    // fremdem Code.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "e2e/.sitzungen/**",
  ]),
]);

export default eslintConfig;
