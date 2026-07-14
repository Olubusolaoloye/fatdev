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
    // Pre-bundle @lifi/widget-provider as a standalone shared chunk.
    include: ['@lifi/widget-provider'],
    esbuildOptions: {
      // Keep @lifi/widget-provider external in ALL esbuild pre-bundle passes
      // (@lifi/widget, @lifi/wallet-management, etc.) so every package resolves
      // to the single pre-bundled chunk above instead of getting its own inlined
      // copy — this guarantees one shared EthereumContext React context instance.
      plugins: [
        {
          name: 'externalize-lifi-widget-provider',
          setup(build: { onResolve: Function }) {
            build.onResolve({ filter: /^@lifi\/widget-provider$/ }, () => ({
              path: '@lifi/widget-provider',
              external: true,
            }))
          },
        },
      ],
    },
  },
})
