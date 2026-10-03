import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registramos el SW a mano en main.tsx (vía virtual:pwa-register) para
      // poder pasar `immediate: true`; con injectRegister: 'auto' el plugin
      // intentaría inyectar su propio script y registrarlo dos veces.
      injectRegister: null,
      includeAssets: [
        'favicon-32.png',
        'favicon-16.png',
        'apple-touch-icon.png',
        'mala-mia-wordmark.png',
      ],
      // Sin esto, un service worker nuevo se queda "esperando" (estado
      // waiting) hasta que se cierren todas las pestañas/la app — en una PWA
      // instalada eso puede tardar días, y mientras tanto la persona sigue
      // viendo el bundle viejo aunque el código ya esté corregido. Forzamos
      // que el SW nuevo tome control de inmediato.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'MALA MÍA',
        short_name: 'MALA MÍA',
        description: 'Sistema administrativo de MALA MÍA',
        lang: 'es',
        theme_color: '#fbf3ef',
        background_color: '#fbf3ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    // Permite exponer solo el frontend (ej. con un tunel) y que las
    // llamadas a la API salgan del mismo origen: evita el problema de
    // cookie de sesion cross-site cuando front y back viven en dominios
    // distintos. En desarrollo normal (sin VITE_API_URL vacio) no se usa.
    // IMPORTANTE: agregar aqui cada nuevo recurso top-level del backend
    // (apps/api/src/modules/*), o sus llamadas caeran silenciosamente al
    // index.html del frontend en vez de llegar a la API.
    proxy: {
      '/auth': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/categories': 'http://localhost:3000',
      '/sizes': 'http://localhost:3000',
      '/colors': 'http://localhost:3000',
      '/products': 'http://localhost:3000',
      '/payment-methods': 'http://localhost:3000',
      '/suppliers': 'http://localhost:3000',
      '/purchases': 'http://localhost:3000',
      '/inventory': 'http://localhost:3000',
      '/sales': 'http://localhost:3000',
      '/availability': 'http://localhost:3000',
      '/finance': 'http://localhost:3000',
      '/expenses': 'http://localhost:3000',
      '/expense-categories': 'http://localhost:3000',
      '/settings': 'http://localhost:3000',
      '/users': 'http://localhost:3000',
      '/reports': 'http://localhost:3000',
      '/audit': 'http://localhost:3000',
      '/consumables': 'http://localhost:3000',
    },
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
