const { app, BrowserWindow, ipcMain } = require('electron')
const http = require('http')
const path = require('path')
const fs = require('fs')

app.disableHardwareAcceleration()

const bundlePath = path.join(__dirname, '..', 'bundle')
const screenshotsDir = path.join(__dirname, '..', 'screenshots')
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir)

const preloadPath = path.join(__dirname, '_screenshot_preload.cjs')
console.log('Preload:', preloadPath, 'exists:', fs.existsSync(preloadPath))

// Simple static file server for the bundle directory
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0]
  let filePath = path.join(bundlePath, urlPath === '/' ? '/index.html' : urlPath)
  const ext = path.extname(filePath)
  const contentType = mimeTypes[ext] || 'application/octet-stream'
  console.log('[HTTP]', req.method, urlPath, '->', filePath.replace(bundlePath, ''))

  try {
    let content = fs.readFileSync(filePath)
    // Patch the JS bundle to allow localhost origins (compiled out in production build)
    if (ext === '.js' && urlPath.includes('index-')) {
      let js = content.toString()
      js = js.replace(
        '["file://"].concat(',
        '["file://","http://localhost:5173"].concat('
      )
      content = Buffer.from(js)
    }
    // Modify HTML for screenshot compatibility
    if (ext === '.html') {
      let html = content.toString()
      const errorScript = `<script>
        window.onerror = function(msg, src, line, col, err) {
          console.error('GLOBAL ERROR:', msg, 'at', src + ':' + line + ':' + col, err && err.stack);
          return false;
        };
        window.addEventListener('unhandledrejection', function(e) {
          console.error('UNHANDLED REJECTION:', e.reason && e.reason.stack || e.reason);
        });
        window.addEventListener('error', function(e) {
          if (e.target && e.target.tagName === 'SCRIPT') {
            console.error('SCRIPT LOAD ERROR:', e.target.src);
          }
        }, true);
        // Log ALL postMessages to debug origin issues
        window.addEventListener('message', function(e) {
          var preview = typeof e.data === 'string' ? e.data.substring(0, 200) : JSON.stringify(e.data).substring(0, 200);
          console.log('MSG origin=' + e.origin + ' data=' + preview);
        }, false);
      </script>`
      // Remove CSP meta tag and inject error handlers
      html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/s, '')
      // Remove type="module" crossorigin from script tag (not needed, bundle is self-contained)
      html = html.replace(' type="module" crossorigin', '')
      html = html.replace('<head>', '<head>' + errorScript)
      content = Buffer.from(html)
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET'
    })
    res.end(content)
  } catch (e) {
    console.log('[HTTP] 404:', urlPath)
    res.writeHead(404)
    res.end('Not found: ' + urlPath)
  }
})

const mockState = {
  main: {
    _version: 41,
    instanceId: 'test',
    colorway: 'dark',
    launch: false,
    reveal: false,
    autohide: false,
    accountCloseLock: false,
    menubarGasPrice: false,
    showLocalNameWithENS: false,
    hardwareDerivation: 'standard',
    mute: { onboardingWindow: true, alphaWarning: true, welcomeWarning: true },
    shortcuts: { summon: { modifierKeys: ['Alt'], shortcutKey: 'Slash', enabled: true, configuring: false } },
    networks: {
      ethereum: {
        1: { id: 1, type: 'ethereum', name: 'Ethereum', layer: 'mainnet', isTestnet: false, on: true, explorer: 'https://etherscan.io', symbol: 'ETH',
          connection: {
            primary: { on: true, current: 'pylon', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        10: { id: 10, type: 'ethereum', name: 'Optimism', layer: 'rollup', isTestnet: false, on: true, explorer: 'https://optimistic.etherscan.io', symbol: 'ETH',
          connection: {
            primary: { on: true, current: 'pylon', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        137: { id: 137, type: 'ethereum', name: 'Polygon', layer: 'sidechain', isTestnet: false, on: true, explorer: 'https://polygonscan.com', symbol: 'MATIC',
          connection: {
            primary: { on: true, current: 'pylon', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        42161: { id: 42161, type: 'ethereum', name: 'Arbitrum', layer: 'rollup', isTestnet: false, on: false, explorer: 'https://arbiscan.io', symbol: 'ETH',
          connection: {
            primary: { on: true, current: 'pylon', status: 'off', connected: false, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        }
      }
    },
    networksMeta: {
      ethereum: {
        1: { blockHeight: 19500000, icon: '', primaryColor: '#627EEA', nativeCurrency: { symbol: 'ETH', name: 'Ether', icon: '', decimals: 18, usd: { price: 3200, change24hr: 1.5 } }, gas: { price: { selected: 'standard', levels: { slow: '20', standard: '25', fast: '30', asap: '50', custom: '' } } } },
        10: { blockHeight: 115000000, icon: '', primaryColor: '#FF0420', nativeCurrency: { symbol: 'ETH', name: 'Ether', icon: '', decimals: 18, usd: { price: 3200, change24hr: 1.5 } }, gas: { price: { selected: 'standard', levels: { slow: '0.001', standard: '0.002', fast: '0.003', asap: '0.005', custom: '' } } } },
        137: { blockHeight: 54000000, icon: '', primaryColor: '#8247E5', nativeCurrency: { symbol: 'MATIC', name: 'Polygon', icon: '', decimals: 18, usd: { price: 0.85, change24hr: -0.3 } }, gas: { price: { selected: 'standard', levels: { slow: '30', standard: '50', fast: '80', asap: '120', custom: '' } } } },
        42161: { blockHeight: 180000000, icon: '', primaryColor: '#28A0F0', nativeCurrency: { symbol: 'ETH', name: 'Ether', icon: '', decimals: 18, usd: { price: 3200, change24hr: 1.5 } }, gas: { price: { selected: 'standard', levels: { slow: '0.1', standard: '0.1', fast: '0.2', asap: '0.5', custom: '' } } } }
      }
    },
    accounts: {
      '0x1234567890abcdef1234567890abcdef12345678': {
        id: '0x1234567890abcdef1234567890abcdef12345678',
        name: 'Main Account',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'ok',
        signer: 'hot-signer-1',
        requests: {},
        ensName: 'alice.eth',
        created: '2024-01-01'
      },
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': {
        id: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        name: 'Hardware Wallet',
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        status: 'ok',
        signer: 'ledger-1',
        requests: {},
        created: '2024-03-15'
      }
    },
    accountsMeta: {},
    knownExtensions: {},
    dapps: {},
    colorwayPrimary: { light: {}, dark: {} },
    origins: {
      'uniswap.org': { chain: { id: 1, type: 'ethereum' }, name: 'Uniswap', session: { requests: 5, startedAt: Date.now() - 3600000, lastUpdatedAt: Date.now() } }
    },
    permissions: {
      '0x1234567890abcdef1234567890abcdef12345678': {
        'perm1': { origin: 'uniswap.org', provider: true, handlerId: 'perm1' }
      }
    },
    balances: {
      '0x1234567890abcdef1234567890abcdef12345678': [
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '2500000000000000000', displayBalance: '2.5' },
        { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: '5000000000', displayBalance: '5000' },
        { address: '0x6b175474e89094c44da98b954eedeac495271d0f', chainId: 1, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, balance: '1200000000000000000000', displayBalance: '1200' }
      ],
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': [
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '15000000000000000000', displayBalance: '15.0' }
      ]
    },
    tokens: {
      custom: [
        { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: '' },
        { address: '0x6b175474e89094c44da98b954eedeac495271d0f', chainId: 1, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoURI: '' }
      ],
      known: {}
    },
    signers: {
      'hot-signer-1': { id: 'hot-signer-1', type: 'ring', name: 'Hot Signer', status: 'ok', addresses: ['0x1234567890abcdef1234567890abcdef12345678'], createdAt: Date.now() },
      'ledger-1': { id: 'ledger-1', type: 'ledger', name: 'Ledger Nano S', status: 'ok', addresses: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'], model: 'Nano S', createdAt: Date.now() }
    },
    savedSigners: {},
    lattice: {},
    latticeSettings: { accountLimit: 5, derivation: 'standard', endpointMode: 'default', endpointCustom: '' },
    ledger: { derivation: 'live', liveAccountLimit: 5 },
    trezor: { derivation: 'standard' },
    privacy: { errorReporting: false },
    updater: { dontRemind: [], badge: null },
    rates: {}
  },
  platform: process.platform
}

const views = ['accounts', 'send', 'signers', 'chains', 'tokens', 'settings']

app.whenReady().then(async () => {
  // Start local HTTP server on port 5173 (must match bridge safeOrigins for dev mode)
  await new Promise((resolve) => server.listen(5173, '127.0.0.1', resolve))
  const port = 5173
  console.log('[Main] HTTP server on port', port)

  // Handle the main:rpc channel (bridge sends RPC calls here)
  ipcMain.on('main:rpc', (event, id, ...args) => {
    const parsedArgs = args.map(a => { try { return JSON.parse(a) } catch { return a } })
    const method = parsedArgs[0]
    console.log('[IPC] main:rpc method:', method)

    if (method === 'getState') {
      event.reply('main:rpc', id, JSON.stringify(null), JSON.stringify(mockState))
    } else {
      event.reply('main:rpc', id, JSON.stringify(null), JSON.stringify(null))
    }
  })

  // Swallow events from renderer
  ipcMain.on('tray:ready', () => { console.log('[IPC] tray:ready received') })
  ipcMain.on('tray:action', () => {})

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true,
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false
    }
  })

  // Capture renderer console output
  win.webContents.on('console-message', (_event, level, message) => {
    const levels = ['LOG', 'WARN', 'ERROR']
    console.log(`[Renderer ${levels[level] || level}] ${message}`)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Load Error]', errorCode, errorDescription)
  })

  win.webContents.on('preload-error', (_event, _preloadPath, error) => {
    console.error('[Preload Error]', error)
  })

  win.webContents.setFrameRate(30)

  // Strip CSP from the HTML (it restricts 'self' which may conflict with http server)
  // Also add the http://127.0.0.1 to the bridge's safe origins
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['']
      }
    })
  })

  // Load via HTTP - must use localhost (not 127.0.0.1) to match bridge safeOrigins
  const url = `http://localhost:${port}/index.html`
  console.log('[Main] Loading:', url)
  await win.loadURL(url)
  console.log('[Main] Page loaded')

  // Test console-message handler
  await win.webContents.executeJavaScript('console.log("TEST: console-message handler works")')
  await new Promise(r => setTimeout(r, 100))
  console.log('[Main] Waiting for React...')

  // Wait for React to initialize
  await new Promise(r => setTimeout(r, 3000))

  // Debug: exhaustive state check
  const debug = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.getElementById('root');
      const info = {
        rootHTML: root ? root.innerHTML.substring(0, 200) : 'NO ROOT',
        rootChildren: root ? root.childNodes.length : -1,
        allElements: document.querySelectorAll('*').length,
        scripts: Array.from(document.querySelectorAll('script')).map(s => ({src: s.src, type: s.type})),
        styles: document.querySelectorAll('style').length,
        links: document.querySelectorAll('link[rel=stylesheet]').length,
      };
      // Check if any global errors were set
      info.errors = window.__errors || [];
      // Try to find React internals
      if (root && root._reactRootContainer) info.hasReactRoot = true;
      // Check Zustand (might be in module scope)
      info.windowKeys = Object.keys(window).filter(k => k.startsWith('__')).join(',');
      return JSON.stringify(info);
    })()
  `)
  console.log('[Debug]', debug)

  // Wait more and check again
  await new Promise(r => setTimeout(r, 3000))
  const rootLen = await win.webContents.executeJavaScript(
    'document.getElementById("root").innerHTML.length'
  )
  console.log('[Debug] Root HTML length after 6s:', rootLen)

  // Screenshot each view
  for (let i = 0; i < views.length; i++) {
    const view = views[i]

    try {
      const result = await win.webContents.executeJavaScript(`
        (() => {
          const buttons = document.querySelectorAll('nav button');
          if (buttons[${i}]) {
            buttons[${i}].click();
            return 'clicked button ' + ${i} + ' of ' + buttons.length;
          }
          return 'no button at index ${i}, total: ' + buttons.length;
        })()
      `)
      console.log('[Nav]', result)
    } catch (err) {
      console.log('[Nav Error]', err.message)
    }

    await new Promise(r => setTimeout(r, 800))

    const image = await win.webContents.capturePage()
    const filename = String(i + 1).padStart(2, '0') + '-' + view + '.png'
    fs.writeFileSync(path.join(screenshotsDir, filename), image.toPNG())
    console.log('Saved: screenshots/' + filename)
  }

  console.log('\nAll screenshots saved to screenshots/ directory')
  server.close()
  app.quit()
})

app.on('window-all-closed', () => app.quit())
