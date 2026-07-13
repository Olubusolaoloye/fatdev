import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    // Force all @lifi packages to resolve from the same location so React
    // context instances (EthereumContext) are shared between our code and
    // the widget's internals. Without this Vite may pre-bundle them into
    // separate chunks giving two different context objects.
    dedupe: ['@lifi/widget-provider', '@lifi/widget', '@lifi/sdk', 'react', 'react-dom', 'wagmi', 'viem'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@lifi/widget-provider'],
  },
})
