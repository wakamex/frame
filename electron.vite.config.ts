import { defineConfig } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
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
    plugins: [tailwindcss()],
    build: {
      outDir: resolve(__dirname, 'bundle'),
      rollupOptions: {
        input: resolve(__dirname, 'app/index.html')
      }
    }
  }
})
