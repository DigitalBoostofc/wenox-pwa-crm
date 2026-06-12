import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // O registro do SW é feito manualmente em src/main.tsx (com checagem
      // periódica de atualização), então não injeta o script automático.
      injectRegister: false,
      // Atualização "instantânea": ao detectar um SW novo, ele assume controle
      // imediato (skipWaiting+clientsClaim) e limpa caches antigos. A próxima
      // navegação/refresh já carrega o bundle novo, sem precisar unregister.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Wenox OS',
        short_name: 'Wenox',
        theme_color: '#080A16',
        background_color: '#080A16',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Bibliotecas em chunks próprios → ficam em cache entre deploys
        // (o usuário só rebaixa o código que realmente mudou).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return 'vendor-react';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('pocketbase')) return 'vendor-pocketbase';
          return 'vendor';
        },
      },
    },
  },
})
