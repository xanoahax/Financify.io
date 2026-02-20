import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserOrOrgPagesRepo = repositoryName?.toLowerCase().endsWith('.github.io')
const defaultBase =
  process.env.GITHUB_ACTIONS === 'true'
    ? isUserOrOrgPagesRepo
      ? '/'
      : repositoryName
        ? `/${repositoryName}/`
        : '/'
    : '/'
const base = process.env.VITE_BASE_PATH || defaultBase

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
