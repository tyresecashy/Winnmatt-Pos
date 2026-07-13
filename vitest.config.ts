import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'

// Load .env.local for tests
const envLocal = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envLocal.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      envVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
    }
  }
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/*.mjs'],
    env: envVars,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
