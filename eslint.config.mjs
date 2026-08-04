import nextConfig from 'eslint-config-next'
import prettierConfig from 'eslint-config-prettier'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  ...nextConfig,
  prettierConfig,
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]
