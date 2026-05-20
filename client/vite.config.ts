import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // если нужно перезаписывать путь, можно добавить rewrite, но тут не нужно
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true, // обязательно для WebSocket
      },
    },
  },
});