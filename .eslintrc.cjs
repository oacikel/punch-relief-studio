module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true, worker: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist', 'coverage', 'playwright-report', 'node_modules'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts', 'src/test/**/*.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};
