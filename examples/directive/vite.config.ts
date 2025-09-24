import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/stream-markdown': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
})
