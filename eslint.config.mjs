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
]

export default config
