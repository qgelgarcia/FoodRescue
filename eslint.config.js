import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/android/**', 'output/**'] },
  {
    files: ['apps/frontend/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { 'no-undef': 'error' },
  },
];
