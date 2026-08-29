/** ESLint configuration for gara_reconstruction_v5 (ESLint v9+) */
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ["next/core-web-vitals"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "warn",
  },
};