const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const jsdoc = require('eslint-plugin-jsdoc');
const globals = require('globals');

module.exports = tseslint.config(
  { ignores: ['build/**', 'node_modules/**', '**/*.js'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-console': 'error',
      'jsdoc/require-jsdoc': 'warn',
      'jsdoc/require-returns-type': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/tag-lines': 'off',
    },
  }
);
