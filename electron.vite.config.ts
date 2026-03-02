import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'compiled/main',
      lib: {
        entry: resolve(__dirname, 'main/index.ts')
      },
      rollupOptions: {
        external: [
          'electron',
          'electron-log',
          'electron-updater',
          'node-hid',
          'usb',
          'ethereum-provider',
          'eth-provider',
          'content-hash',
          'eth-ens-namehash'
        ]
      }
    }
  },
  preload: {
    build: {
      outDir: 'bundle',
      lib: {
        entry: resolve(__dirname, 'resources/bridge/index.ts')
      },
      rollupOptions: {
        output: {
          entryFileNames: 'bridge.js'
        }
      }
    }
  },
  renderer: {
    root: 'app',
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react'
    },
    build: {
      outDir: resolve(__dirname, 'bundle'),
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'app/index.html')
      }
    }
  }
})
