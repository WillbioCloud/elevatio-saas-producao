import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-joyride': fileURLToPath(new URL('./src/vendor/react-joyride.tsx', import.meta.url)),
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600, // Aumenta o limite para 1.6MB (silencia o aviso)
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separa bibliotecas pesadas em arquivos diferentes
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});