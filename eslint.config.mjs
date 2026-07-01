// @ts-check

import nextEslint from 'eslint-config-next'

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextEslint,
  {
    rules: {
      'no-console': 'warn',
    },
  },
  {
    ignores: [
      'scripts/*.js',
      'scripts/*.mjs',
      '*.js',
      '*.mjs',
      'tests/*.mjs',
    ],
  },
]

export default config
