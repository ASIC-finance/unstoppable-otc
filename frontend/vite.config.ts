import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@reown/appkit')) return 'vendor-appkit'
          if (id.includes('/lit-html/') || id.includes('/lit/') || id.includes('/@lit/')) return 'vendor-lit'
          if (id.includes('/wagmi/')) return 'vendor-wagmi'
          if (id.includes('/viem/')) return 'vendor-viem'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/@tanstack/react-query')
          ) return 'vendor-react'
        },
      },
    },
    // AppKit (wallet connect SDK) is inherently ~2.4MB; suppress the warning
    chunkSizeWarningLimit: 2500,
  },
})
