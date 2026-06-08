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
})
