import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: BACKEND_URL env override so the same config works both on the host (localhost) and inside docker compose (service name)
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    // ponytail: polling, not native fs events, since bind mounts on Docker Desktop (Windows) don't propagate file-change notifications
    watch: { usePolling: true },
    proxy: {
      '/auth':                     backendUrl,
      '/users':                    backendUrl,
      '/teams':                    backendUrl,
      '/projects':                 backendUrl,
      '/applications':             backendUrl,
      '/application-environments': backendUrl,
      '/deployment-requests':      backendUrl,
    },
  },
});
