import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Vitest brings its own Vite. We intentionally avoid loading the
  // Tailwind plugin here — it isn't needed for unit tests and pulls in the
  // whole CSS pipeline, which the `css: false` option skips anyway.
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
