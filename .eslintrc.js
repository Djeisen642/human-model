module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  env: {
    node: true
  },
  plugins: [
    '@typescript-eslint',
    'jsdoc'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsdoc/recommended'
  ],
  rules: {
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    semi: ['error', 'always'],
    quotes: ['error', 'single'],
    'no-console': 2,
    'jsdoc/require-jsdoc': 1,
    'jsdoc/require-returns-type': 0,
    'jsdoc/require-param-type': 0
  }
};