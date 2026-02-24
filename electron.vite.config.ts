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
        external: ['electron', 'electron-log', 'electron-updater', 'node-hid', 'usb']
      }
    }
  },
  preload: {
    build: {
      outDir: 'bundle',
      lib: {
        entry: resolve(__dirname, 'resources/bridge/index.js')
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
    build: {
      outDir: resolve(__dirname, 'bundle'),
      rollupOptions: {
        input: {
          tray: resolve(__dirname, 'app/tray/index.html'),
          dash: resolve(__dirname, 'app/dash/index.html')
        }
      }
    }
  }
})
