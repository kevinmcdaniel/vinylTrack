import nextConfig from "eslint-config-next";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...nextConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "inline-type-imports" }],
    },
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },
];

export default eslintConfig;
