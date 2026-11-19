import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    // Polling necessário para hot-reload funcionar em volumes Docker no Windows
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/test/**',
        'src/main.jsx',
        '**/*.config.*',
        'dist/**',
      ],
    },
  },
})
