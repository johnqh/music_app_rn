module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  env: { es2022: true, node: true },
  globals: { __DEV__: 'readonly', console: 'readonly' },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'off',
  },
  // Ambient declaration file: its generic parameters exist to match React
  // Native's own signatures and are unused by definition.
  ignorePatterns: ['node_modules/', 'dist/', '*.js', 'src/nativewind-env.d.ts'],
};
