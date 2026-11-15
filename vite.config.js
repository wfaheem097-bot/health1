import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const proxy = { '/api': 'http://127.0.0.1:8000' };

export default defineConfig({
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      input: {
        overview: fileURLToPath(new URL('./index.html', import.meta.url)),
        checkIn: fileURLToPath(new URL('./daily-check-in.html', import.meta.url)),
        heartRate: fileURLToPath(new URL('./heart-rate.html', import.meta.url)),
      },
    },
  },
});

