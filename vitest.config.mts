import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': root,
    },
  },
  test: {
    environment: 'node',
    // Session worktrees live under .claude/ and carry their own copies of the tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
    setupFiles: ['./tests/setup.ts'],
  },
})
