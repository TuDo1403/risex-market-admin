import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import tseslint from 'typescript-eslint'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

export default tseslint.config(
  {
    ignores: ['.next/**', '.remember/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommended,
)
