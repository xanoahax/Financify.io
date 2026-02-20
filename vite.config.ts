import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
