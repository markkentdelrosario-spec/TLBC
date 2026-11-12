import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000';

function createApiProxyOptions({ ws = false } = {}) {
  return {
    target: apiProxyTarget,
    changeOrigin: true,
    ws,
    configure(proxy) {
      proxy.on('error', (error, request) => {
        console.error(
          `[vite proxy] ${request?.method || 'request'} ${request?.url || ''} -> ${apiProxyTarget}: ${error.code || error.message}`
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': createApiProxyOptions(),
      '/socket.io': createApiProxyOptions({ ws: true }),
    },
  },
});
