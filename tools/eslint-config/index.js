module.exports = {
  extends: ['prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'turbo'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'turbo/no-undeclared-env-vars': 'warn',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint', 'turbo'],
      extends: ['prettier'],
      rules: {
        'turbo/no-undeclared-env-vars': 'warn',
      },
    },
  ],
};
