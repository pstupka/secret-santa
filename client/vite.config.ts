import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// The API the dev server proxies `/api` to; in docker compose it is the
// `server` service rather than localhost.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    // vue-i18n: Composition API only, no devtools in production builds.
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    // Same-origin in dev too, like in production where the API serves the SPA.
    proxy: { '/api': { target: apiProxyTarget, changeOrigin: false } },
  },
  build: {
    // Served by the API from `client/dist` with an SPA fallback (#17).
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
