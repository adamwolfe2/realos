import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "scripts/**",
      ".claude/**",
      "marketing-assets/codegen/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // react-hooks v6 experimental compiler preset — heavy false positives on
      // RSC/server-component patterns; revisit when React Compiler is adopted.
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      // Stylistic noise, not correctness:
      "react/no-unescaped-entities": "off",
      // Underscore prefix = intentionally unused (exclusion destructures,
      // future-API stubs, signature-preserving params):
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Real tech debt — keep visible as warnings, not blocking:
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default config;
