/** ESLint configuration for gara_reconstruction_v5 (ESLint v9 flat config) */
import typescriptParser from '@typescript-eslint/parser';

export default {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parser: typescriptParser,
    globals: {
      console: "readonly",
    },
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "warn",
  },
};