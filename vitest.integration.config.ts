import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { include: ['integration/**/*.test.ts'], environment: 'node', maxWorkers: 1, testTimeout: 20_000, hookTimeout: 30_000 },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
