import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

const mainExternals = [
  'electron',
  'electron-log',
  'electron-updater',
  'node-hid',
  'usb',
  'ethereum-provider',
  'eth-provider',
  'eth-ens-namehash',
  'nebula',
  '@ledgerhq/hw-transport-node-hid-singleton',
  '@ledgerhq/hw-transport-node-hid-noevents',
  '@ledgerhq/hw-transport',
  '@ledgerhq/hw-app-eth'
]

export default defineConfig({
  main: {
    resolve: {
      extensions: ['.ts', '.js', '.mjs', '.mts', '.json']
    },
    build: {
      outDir: 'compiled/main',
      lib: {
        entry: {
          index: resolve(__dirname, 'main/index.ts'),
          'workers/balances': resolve(__dirname, 'main/externalData/balances/worker.ts'),
          'workers/ringSigner': resolve(__dirname, 'main/signers/hot/RingSigner/worker.ts'),
          'workers/seedSigner': resolve(__dirname, 'main/signers/hot/SeedSigner/worker.ts')
        }
      },
      rollupOptions: {
        external: mainExternals,
        output: {
          interop: 'auto'
        }
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
