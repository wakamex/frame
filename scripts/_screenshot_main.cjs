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
            primary: { on: true, current: 'public', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        10: { id: 10, type: 'ethereum', name: 'Optimism', layer: 'rollup', isTestnet: false, on: true, explorer: 'https://optimistic.etherscan.io', symbol: 'ETH',
          connection: {
            primary: { on: true, current: 'public', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        137: { id: 137, type: 'ethereum', name: 'Polygon', layer: 'sidechain', isTestnet: false, on: true, explorer: 'https://polygonscan.com', symbol: 'MATIC',
          connection: {
            primary: { on: true, current: 'public', status: 'connected', connected: true, custom: '', type: '', network: '' },
            secondary: { on: false, current: 'custom', status: 'off', connected: false, custom: '', type: '', network: '' }
          }
        },
        42161: { id: 42161, type: 'ethereum', name: 'Arbitrum', layer: 'rollup', isTestnet: false, on: false, explorer: 'https://arbiscan.io', symbol: 'ETH',
          connection: {
            primary: { on: true, current: 'public', status: 'off', connected: false, custom: '', type: '', network: '' },
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
        requests: {
          'req-1': {
            handlerId: 'req-1',
            type: 'transaction',
            status: 'pending',
            origin: 'uniswap.org',
            account: '0x1234567890abcdef1234567890abcdef12345678',
            created: Date.now(),
            payload: {
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_sendTransaction',
              params: [{ from: '0x1234567890abcdef1234567890abcdef12345678', to: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', value: '0x2386f26fc10000', chainId: '0x1', gas: '0x5208' }]
            },
            data: {
              from: '0x1234567890abcdef1234567890abcdef12345678',
              to: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
              value: '0x2386f26fc10000',
              chainId: '0x1',
              gasLimit: '0x5208',
              gasPrice: '0x5d21dba00'
            }
          }
        },
        ensName: 'alice.eth',
        created: '2024-01-01'
      },
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': {
        id: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        name: 'Hardware Wallet',
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        status: 'ok',
        signer: 'ledger-1',
        requests: {
          'req-sig-1': {
            handlerId: 'req-sig-1',
            type: 'signTypedData',
            status: 'pending',
            origin: 'app.aave.com',
            account: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            created: Date.now(),
            payload: {
              jsonrpc: '2.0', id: 2, method: 'eth_signTypedData_v4',
              params: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', JSON.stringify({
                types: { EIP712Domain: [{ name: 'name', type: 'string' }], Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
                primaryType: 'Permit',
                domain: { name: 'USD Coin' },
                message: { owner: '0xabcdef...', spender: '0x1111...', value: '1000000000', deadline: String(Math.floor(Date.now()/1000) + 3600) }
              })]
            }
          },
          'req-addtoken-1': {
            handlerId: 'req-addtoken-1',
            type: 'addToken',
            status: 'pending',
            origin: 'app.aave.com',
            account: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            created: Date.now(),
            token: { address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', symbol: 'AAVE', name: 'Aave Token', decimals: 18, chainId: 1 },
            payload: { jsonrpc: '2.0', id: 5, method: 'wallet_watchAsset', params: [{ type: 'ERC20', options: { address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' } }] }
          }
        },
        created: '2024-03-15'
      },
      '0x9999888877776666555544443333222211110000': {
        id: '0x9999888877776666555544443333222211110000',
        name: 'Trezor Account',
        address: '0x9999888877776666555544443333222211110000',
        status: 'ok',
        signer: 'trezor-1',
        requests: {},
        created: '2024-09-01'
      },
      '0x5555555555555555555555555555555555555555': {
        id: '0x5555555555555555555555555555555555555555',
        name: 'DeFi Wallet',
        address: '0x5555555555555555555555555555555555555555',
        status: 'ok',
        signer: 'ring-2',
        requests: {
          'req-eip1559': {
            handlerId: 'req-eip1559',
            type: 'transaction',
            status: 'pending',
            origin: 'app.uniswap.org',
            account: '0x5555555555555555555555555555555555555555',
            created: Date.now(),
            payload: {
              jsonrpc: '2.0',
              id: 3,
              method: 'eth_sendTransaction',
              params: [{ from: '0x5555555555555555555555555555555555555555', to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', value: '0x0', chainId: '0x1', gas: '0x1e848' }]
            },
            data: {
              from: '0x5555555555555555555555555555555555555555',
              to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              value: '0x0',
              chainId: '0x1',
              gasLimit: '0x1e848',
              type: '0x2',
              maxFeePerGas: '0x2540be400',
              maxPriorityFeePerGas: '0x3b9aca00',
              data: '0xa9059cbb000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef0000000000000000000000000000000000000000000000000000000077359400'
            }
          }
        },
        created: '2024-06-01'
      }
    },
    accountsMeta: {},
    knownExtensions: {},
    dapps: {},
    colorwayPrimary: { light: {}, dark: {} },
    origins: {
      'uniswap.org': { chain: { id: 1, type: 'ethereum' }, name: 'Uniswap', session: { requests: 5, startedAt: Date.now() - 3600000, lastUpdatedAt: Date.now() } },
      'app.aave.com': { chain: { id: 1, type: 'ethereum' }, name: 'Aave', session: { requests: 3, startedAt: Date.now() - 7200000, lastUpdatedAt: Date.now() } },
      'opensea.io': { chain: { id: 1, type: 'ethereum' }, name: 'OpenSea', session: { requests: 8, startedAt: Date.now() - 86400000, lastUpdatedAt: Date.now() } },
      'lido.fi': { chain: { id: 1, type: 'ethereum' }, name: 'Lido', session: { requests: 2, startedAt: Date.now() - 43200000, lastUpdatedAt: Date.now() } }
    },
    permissions: {
      '0x1234567890abcdef1234567890abcdef12345678': {
        'perm1': { origin: 'uniswap.org', provider: true, handlerId: 'perm1' },
        'perm2': { origin: 'app.aave.com', provider: true, handlerId: 'perm2' },
        'perm3': { origin: 'opensea.io', provider: true, handlerId: 'perm3' },
        'perm4': { origin: 'lido.fi', provider: true, handlerId: 'perm4' }
      }
    },
    balances: {
      '0x1234567890abcdef1234567890abcdef12345678': [
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '2500000000000000000', displayBalance: '2.5' },
        { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: '5000000000', displayBalance: '5000' },
        { address: '0x6b175474e89094c44da98b954eedeac495271d0f', chainId: 1, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, balance: '1200000000000000000000', displayBalance: '1200' },
        { address: '0x0000000000000000000000000000000000000000', chainId: 10, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '800000000000000000', displayBalance: '0.8' },
        { address: '0x0000000000000000000000000000000000000000', chainId: 137, symbol: 'MATIC', name: 'Polygon', decimals: 18, balance: '5000000000000000000000', displayBalance: '5000' }
      ],
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': [
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '15000000000000000000', displayBalance: '15.0' },
        { address: '0x0000000000000000000000000000000000000000', chainId: 10, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '3000000000000000000', displayBalance: '3.0' }
      ],
      '0x5555555555555555555555555555555555555555': [
        { address: '0x0000000000000000000000000000000000000000', chainId: 1, symbol: 'ETH', name: 'Ether', decimals: 18, balance: '500000000000000000', displayBalance: '0.5' },
        { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6, balance: '10000000000', displayBalance: '10000' }
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
      'ledger-1': { id: 'ledger-1', type: 'ledger', name: 'Ledger Nano S', status: 'ok', addresses: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'], model: 'Nano S', createdAt: Date.now() },
      'ring-2': { id: 'ring-2', type: 'ring', name: 'Hot Signer 2', status: 'ok', addresses: ['0x5555555555555555555555555555555555555555'], createdAt: Date.now() },
      'trezor-1': { id: 'trezor-1', type: 'trezor', name: 'Trezor Model T', status: 'error', addresses: ['0x9999888877776666555544443333222211110000'], model: 'Model T', createdAt: Date.now(), error: 'Device disconnected' },
      'lattice-1': { id: 'lattice-1', type: 'lattice', name: 'GridPlus Lattice', status: 'off', addresses: [], createdAt: Date.now() }
    },
    txHistory: {
      '0x1234567890abcdef1234567890abcdef12345678': [
        { hash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1', status: 'confirmed', submittedAt: Date.now() - 86400000, chainId: 1, decodedName: 'Transfer USDC' },
        { hash: '0x789abc012def789abc012def789abc012def789abc012def789abc012def789a', status: 'pending', submittedAt: Date.now() - 300000, chainId: 1, decodedName: null },
        { hash: '0xdef012345abc678def012345abc678def012345abc678def012345abc678def0', status: 'failed', submittedAt: Date.now() - 3600000, chainId: 137, decodedName: 'Swap on Uniswap' }
      ]
    },
    savedSigners: {},
    lattice: {},
    latticeSettings: { accountLimit: 5, derivation: 'standard', endpointMode: 'default', endpointCustom: '' },
    ledger: { derivation: 'live', liveAccountLimit: 5 },
    trezor: { derivation: 'standard' },
    privacy: { errorReporting: false },
    updater: { dontRemind: [], badge: null },
    rates: {},
    addressBook: {
      'contact-1': { name: 'Alice Nakamoto', address: '0xaaaa111122223333444455556666777788889999', notes: 'Cold storage wallet' },
      'contact-2': { name: 'Bob Vance', address: '0xbbbb111122223333444455556666777788889999', notes: '' },
      'contact-3': { name: 'Treasury DAO', address: '0xcccc111122223333444455556666777788889999', notes: 'Multisig - 3 of 5 signers' },
      'contact-4': { name: 'DEX Router', address: '0xdddd111122223333444455556666777788889999', notes: 'Uniswap V3 router' }
    }
  },
  platform: process.platform
}

const views = ['accounts', 'portfolio', 'send', 'contacts', 'signers', 'history', 'chains', 'tokens', 'settings']

// Interactions to perform after navigating to each view.
// Each returns a description of what was done, for logging.
const interactions = {
  accounts: [
    {
      name: 'request-overlay',
      js: `(() => {
        // The request overlay renders when pendingRequests.length > 0.
        // With a pending transaction in state it should be visible now.
        const overlay = document.querySelector('.fixed.inset-0');
        if (overlay) return 'request overlay visible: ' + overlay.textContent.substring(0, 80);
        return 'request overlay not found';
      })()`
    },
    {
      name: 'gas-adjuster',
      js: `(() => {
        // The request overlay should be showing. Find and click the 'Adjust' button.
        const btns = Array.from(document.querySelectorAll('button'));
        const adjustBtn = btns.find(b => b.textContent.trim() === 'Adjust');
        if (adjustBtn) { adjustBtn.click(); return 'clicked Adjust button'; }
        return 'no Adjust button found, buttons: ' + btns.map(b => b.textContent.trim().substring(0, 20)).join(', ');
      })()`
    },
    {
      name: 'account-detail',
      js: `(() => {
        // Click the first account in the list to show detail
        const btn = document.querySelector('[class*="AccountList"] button, main button');
        const accountBtns = Array.from(document.querySelectorAll('main button')).filter(b => b.textContent.includes('Account') || b.querySelector('[data-testid]'));
        // Find buttons that look like account entries (have address-like text)
        const candidates = Array.from(document.querySelectorAll('main button')).filter(b => b.textContent.match(/0x[0-9a-f]/i) || b.textContent.includes('Main Account'));
        if (candidates[0]) { candidates[0].click(); return 'clicked account: ' + candidates[0].textContent.substring(0, 40); }
        return 'no account button found, buttons: ' + document.querySelectorAll('main button').length;
      })()`
    },
    {
      name: 'account-rename-form',
      js: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const renameBtn = btns.find(b => b.textContent.trim() === 'rename');
        if (renameBtn) { renameBtn.click(); return 'clicked rename button'; }
        return 'no rename button found';
      })()`
    },
    {
      name: 'remove-account-modal',
      js: `(() => {
        // First ensure we're in account detail view (click first account if needed)
        const candidates = Array.from(document.querySelectorAll('main button')).filter(b =>
          b.textContent.includes('Main Account') || b.textContent.match(/0x[0-9a-f]/i)
        );
        if (candidates[0]) candidates[0].click();
        // Wait a tick, then find and click the Remove button
        return new Promise(resolve => {
          setTimeout(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const removeBtn = btns.find(b => b.textContent.includes('Remove'));
            if (removeBtn) { removeBtn.click(); resolve('clicked Remove button'); }
            else resolve('no Remove button found');
          }, 300);
        });
      })()`
    },
    {
      name: 'add-account',
      js: `(() => {
        // Click the '+ Add' button to reveal the account type selector panel
        const buttons = Array.from(document.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent.trim() === '+ Add' || b.textContent.trim() === 'Add');
        if (addBtn) { addBtn.click(); return 'clicked: ' + addBtn.textContent.trim(); }
        return 'no + Add button found, buttons: ' + buttons.map(b => b.textContent.trim()).join(', ');
      })()`
    },
    {
      name: 'signature-request',
      js: `(() => {
        // Close the add-account panel (Cancel) then click Hardware Wallet to show its signature request overlay
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
        return new Promise(resolve => setTimeout(() => {
          const btns = Array.from(document.querySelectorAll('main button'));
          const hwBtn = btns.find(b => b.textContent.includes('Hardware'));
          if (hwBtn) { hwBtn.click(); resolve('clicked: ' + hwBtn.textContent.substring(0, 40)); }
          else resolve('no Hardware Wallet button found, buttons: ' + btns.map(b => b.textContent.substring(0, 20)).join(' | '));
        }, 300));
      })()`
    },
    {
      name: 'eip1559-transaction',
      js: `(() => {
        // Navigate through the request queue to find the EIP-1559 transaction (shows Max Fee + Priority instead of Gas Price)
        return new Promise(resolve => {
          let attempts = 0;
          const findEIP1559 = () => {
            if (attempts++ > 8) { resolve('EIP-1559 request not found after 8 attempts'); return; }
            const text = document.body.innerText;
            if (text.includes('Max Fee') && text.includes('Priority')) {
              resolve('EIP-1559 transaction overlay visible with max fee and priority fields');
              return;
            }
            const btns = Array.from(document.querySelectorAll('button'));
            const nextBtn = btns.find(b => b.textContent.trim().includes('Next') && !b.disabled);
            if (nextBtn) { nextBtn.click(); setTimeout(findEIP1559, 300); }
            else resolve('No next button available, overlay text: ' + text.substring(0, 100));
          };
          setTimeout(findEIP1559, 300);
        });
      })()`
    },
    {
      name: 'addtoken-request',
      js: `(() => {
        // Navigate the request overlay queue to find the addToken request
        return new Promise(resolve => {
          let attempts = 0;
          const findAddToken = () => {
            if (attempts++ > 8) { resolve('addToken request not found after 8 attempts'); return; }
            const text = document.body.innerText;
            if (text.includes('Add Token') && (text.includes('AAVE') || text.includes('Aave'))) {
              resolve('addToken overlay visible with AAVE token details');
              return;
            }
            const btns = Array.from(document.querySelectorAll('button'));
            // Try Prev first (likely we are at or past the addToken position)
            const prevBtn = btns.find(b => b.textContent.includes('Prev') && !b.disabled);
            if (prevBtn) { prevBtn.click(); setTimeout(findAddToken, 300); return; }
            // Fall back to Next
            const nextBtn = btns.find(b => b.textContent.includes('Next') && !b.disabled);
            if (nextBtn) { nextBtn.click(); setTimeout(findAddToken, 300); return; }
            resolve('addToken overlay not found, no navigation available, text: ' + text.substring(0, 100));
          };
          setTimeout(findAddToken, 300);
        });
      })()`
    },
    {
      name: 'account-with-permissions',
      js: `(() => {
        // Dismiss any open modals/panels, navigate to accounts, click Main Account to show multiple dapp permissions
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return new Promise(resolve => setTimeout(() => {
          const navBtns = document.querySelectorAll('nav button');
          if (navBtns[0]) navBtns[0].click();
          setTimeout(() => {
            const candidates = Array.from(document.querySelectorAll('main button')).filter(b =>
              b.textContent.includes('Main Account') || b.textContent.match(/0x[0-9a-f]/i)
            );
            if (candidates[0]) { candidates[0].click(); resolve('clicked Main Account to show permissions list'); }
            else resolve('no Main Account button found, buttons: ' + document.querySelectorAll('main button').length);
          }, 300);
        }, 300));
      })()`
    }
  ],
  portfolio: [
    {
      name: 'portfolio-by-chain-collapsed',
      js: `(() => {
        // Collapse the 'By Chain' section by clicking its header button
        const sectionBtns = Array.from(document.querySelectorAll('main button')).filter(b =>
          b.textContent.includes('By Chain') || b.textContent.includes('BY CHAIN')
        );
        if (sectionBtns[0]) { sectionBtns[0].click(); return 'collapsed By Chain section'; }
        return 'By Chain section button not found';
      })()`
    },
    {
      name: 'portfolio-by-account-collapsed',
      js: `(() => {
        // Re-expand 'By Chain', then collapse 'By Account' section
        const allBtns = Array.from(document.querySelectorAll('main button'));
        const byChainBtn = allBtns.find(b => b.textContent.includes('By Chain') || b.textContent.includes('BY CHAIN'));
        if (byChainBtn) byChainBtn.click();
        const byAccountBtn = allBtns.find(b => b.textContent.includes('By Account') || b.textContent.includes('BY ACCOUNT'));
        if (byAccountBtn) { byAccountBtn.click(); return 'expanded By Chain, collapsed By Account'; }
        return 'By Account section button not found';
      })()`
    },
    {
      name: 'portfolio-all-expanded',
      js: `(() => {
        // Expand all collapsed sections so both By Chain and By Account are visible
        const allBtns = Array.from(document.querySelectorAll('main button'));
        const byAccountBtn = allBtns.find(b => b.textContent.includes('By Account') || b.textContent.includes('BY ACCOUNT'));
        if (byAccountBtn) { byAccountBtn.click(); return 'expanded By Account section'; }
        return 'By Account section button not found';
      })()`
    }
  ],
  send: [
    {
      name: 'send-filled-form',
      js: `(() => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        // Find recipient input and fill it
        const inputs = Array.from(document.querySelectorAll('input'));
        const recipientInput = inputs.find(i => i.placeholder?.includes('0x') || i.name === 'recipient');
        if (recipientInput) {
          nativeSetter.call(recipientInput, '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
          recipientInput.dispatchEvent(new Event('input', { bubbles: true }));
          recipientInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Find amount input and set a large value to trigger insufficient balance
        const amountInput = inputs.find(i => i.placeholder?.includes('0.0') || i.type === 'number' || i.name === 'amount');
        if (amountInput) {
          nativeSetter.call(amountInput, '999999');
          amountInput.dispatchEvent(new Event('input', { bubbles: true }));
          amountInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return 'filled recipient and amount, inputs found: ' + inputs.length;
      })()`
    }
  ],
  contacts: [
    {
      name: 'add-contact-modal',
      js: `(() => {
        // Click the '+ Add Contact' button to reveal the add-contact modal
        const buttons = Array.from(document.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent.includes('Add Contact'));
        if (addBtn) { addBtn.click(); return 'clicked: ' + addBtn.textContent.trim(); }
        return 'no Add Contact button found, buttons: ' + buttons.length;
      })()`
    },
    {
      name: 'contact-detail-with-notes',
      js: `(() => {
        // Close any open modal (Escape key dismisses the Modal component)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return new Promise(resolve => setTimeout(() => {
          // Find the contact row for Alice or Treasury (both have notes) and click Edit
          const contactDivs = Array.from(document.querySelectorAll('main .space-y-2 > div'));
          const notesDiv = contactDivs.find(d => d.textContent.includes('Alice') || d.textContent.includes('Treasury'));
          if (notesDiv) {
            const editBtn = Array.from(notesDiv.querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit');
            if (editBtn) { editBtn.click(); resolve('clicked Edit for: ' + notesDiv.textContent.substring(0, 50)); return; }
          }
          resolve('no contact row with notes found, rows: ' + contactDivs.length);
        }, 300));
      })()`
    },
    {
      name: 'contact-delete-confirmation',
      js: `(() => {
        // Close the edit modal
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return new Promise(resolve => setTimeout(() => {
          // Find Treasury DAO row (has notes) and click Delete
          const contactDivs = Array.from(document.querySelectorAll('main .space-y-2 > div'));
          const targetDiv = contactDivs.find(d => d.textContent.includes('Treasury') || d.textContent.includes('Alice'));
          if (targetDiv) {
            const deleteBtn = Array.from(targetDiv.querySelectorAll('button')).find(b => b.textContent.trim() === 'Delete');
            if (deleteBtn) { deleteBtn.click(); resolve('clicked Delete for: ' + targetDiv.textContent.substring(0, 50)); return; }
          }
          resolve('no contact row found for deletion, rows: ' + contactDivs.length);
        }, 300));
      })()`
    }
  ],
  signers: [
    {
      name: 'signer-detail',
      js: `(() => {
        // Click the first signer button in the list to reveal the detail panel
        const mainBtns = Array.from(document.querySelectorAll('main button'));
        const signerBtn = mainBtns.find(b => b.textContent.match(/hot|ledger|trezor|lattice|seed/i));
        if (signerBtn) { signerBtn.click(); return 'clicked signer: ' + signerBtn.textContent.substring(0, 60); }
        return 'no signer button found, main buttons: ' + mainBtns.map(b => b.textContent.trim()).join(', ');
      })()`
    },
    {
      name: 'signer-error-detail',
      js: `(() => {
        // Click the Trezor signer which has error/disconnected status to show its detail panel
        const mainBtns = Array.from(document.querySelectorAll('main button'));
        const trezorBtn = mainBtns.find(b => b.textContent.match(/trezor/i));
        if (trezorBtn) { trezorBtn.click(); return 'clicked error signer: ' + trezorBtn.textContent.substring(0, 60); }
        // Fallback: look for a button with error status indicator
        const errorBtn = mainBtns.find(b => b.querySelector('[title="error"]') || b.querySelector('[title="disconnected"]'));
        if (errorBtn) { errorBtn.click(); return 'clicked error-status signer: ' + errorBtn.textContent.substring(0, 60); }
        return 'no error signer button found, main buttons: ' + mainBtns.map(b => b.textContent.trim().substring(0, 30)).join(', ');
      })()`
    },
    {
      name: 'signer-disconnected',
      js: `(() => {
        // Click the Lattice signer which has off/disconnected status
        const mainBtns = Array.from(document.querySelectorAll('main button'));
        const latticeBtn = mainBtns.find(b => b.textContent.match(/lattice|gridplus/i));
        if (latticeBtn) { latticeBtn.click(); return 'clicked disconnected signer: ' + latticeBtn.textContent.substring(0, 60); }
        return 'no lattice signer button found, main buttons: ' + mainBtns.map(b => b.textContent.trim().substring(0, 30)).join(', ');
      })()`
    }
  ],
  chains: [
    {
      name: 'chain-detail',
      js: `(() => {
        // Click the Ethereum chain entry to reveal its detail panel
        const buttons = Array.from(document.querySelectorAll('main button'));
        const ethereumBtn = buttons.find(b => b.textContent.includes('Ethereum'));
        if (ethereumBtn) { ethereumBtn.click(); return 'clicked chain: ' + ethereumBtn.textContent.substring(0, 60); }
        return 'no Ethereum button found, main buttons: ' + buttons.length;
      })()`
    },
    {
      name: 'chain-discovery',
      js: `(() => {
        // Look for 'Discover' or 'Add Chain' or '+' button in the chains view
        const btns = Array.from(document.querySelectorAll('button'));
        const discoverBtn = btns.find(b =>
          b.textContent.includes('Discover') ||
          b.textContent.includes('Add Chain') ||
          b.textContent.trim() === '+'
        );
        if (discoverBtn) { discoverBtn.click(); return 'clicked: ' + discoverBtn.textContent.trim(); }
        return 'no discover button found, buttons: ' + btns.map(b => b.textContent.trim().substring(0, 20)).join(', ');
      })()`
    },
    {
      name: 'chain-health-variants',
      stateUpdates: [
        { path: 'main.networks.ethereum.10.connection.primary.status', value: 'loading' },
        { path: 'main.networks.ethereum.137.connection.primary.status', value: 'error' },
        { path: 'main.networks.ethereum.137.connection.primary.connected', value: false }
      ],
      js: `(() => {
        // The health indicators should already be visible in the chain list
        // Just report what we see
        const badges = document.querySelectorAll('[class*="status"], [class*="health"], [class*="badge"]');
        return 'status indicators found: ' + badges.length;
      })()`
    }
  ],
  tokens: [
    {
      name: 'remove-token-modal',
      js: `(() => {
        // Find a remove/delete/trash button next to a token entry
        const btns = Array.from(document.querySelectorAll('main button'));
        // Look for buttons with trash icon, 'Remove', 'Delete', or '×' text
        const removeBtn = btns.find(b =>
          b.textContent.includes('Remove') ||
          b.textContent.includes('Delete') ||
          b.querySelector('svg[data-icon="trash"]') ||
          b.getAttribute('aria-label')?.includes('remove') ||
          b.getAttribute('title')?.includes('Remove')
        );
        if (removeBtn) { removeBtn.click(); return 'clicked remove button'; }
        // Fallback: look for small icon-only buttons near token entries
        const iconBtns = btns.filter(b => b.textContent.trim().length < 3 && b.querySelector('svg'));
        if (iconBtns[0]) { iconBtns[0].click(); return 'clicked icon button (likely remove)'; }
        return 'no remove button found, main buttons: ' + btns.map(b => b.textContent.trim().substring(0, 20)).join(', ');
      })()`
    }
  ],
  settings: [
    {
      name: 'shortcut-configurator',
      js: `(() => {
        // Scroll to find the keyboard shortcut section
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
        // Find the 'Change' button near the shortcut display
        const btns = Array.from(document.querySelectorAll('button'));
        const changeBtn = btns.find(b => b.textContent.trim() === 'Change');
        if (changeBtn) { changeBtn.click(); return 'clicked Change button'; }
        return 'no Change button found, buttons: ' + btns.map(b => b.textContent.trim().substring(0, 20)).join(', ');
      })()`
    }
  ]
}

async function waitForApp(win) {
  // Wait for React to mount and render content
  for (let attempt = 0; attempt < 20; attempt++) {
    const rootLen = await win.webContents.executeJavaScript(
      'document.getElementById("root")?.innerHTML?.length || 0'
    )
    if (rootLen > 100) {
      console.log(`[Main] App rendered (${rootLen} chars) after ${(attempt + 1) * 500}ms`)
      return true
    }
    await new Promise(r => setTimeout(r, 500))
  }
  console.error('[Main] App did not render within 10s')
  return false
}

async function captureScreenshot(win, name) {
  await new Promise(r => setTimeout(r, 500)) // settle time
  const image = await win.webContents.capturePage()
  const png = image.toPNG()
  fs.writeFileSync(path.join(screenshotsDir, name + '.png'), png)
  console.log('Saved: screenshots/' + name + '.png')
  return png
}

// Validate screenshot isn't blank (all same color)
function validateScreenshot(png, name) {
  // Check that the PNG is reasonably large (not a tiny error page)
  if (png.length < 5000) {
    console.error(`[FAIL] ${name}: screenshot too small (${png.length} bytes) — likely blank`)
    return false
  }
  return true
}

app.whenReady().then(async () => {
  await new Promise((resolve) => server.listen(5173, '127.0.0.1', resolve))
  const port = 5173
  console.log('[Main] HTTP server on port', port)

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

  const errors = []
  win.webContents.on('console-message', (_event, level, message) => {
    const levels = ['LOG', 'WARN', 'ERROR']
    const tag = levels[level] || level
    if (level >= 2) errors.push(message)
    console.log(`[Renderer ${tag}] ${message}`)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Load Error]', errorCode, errorDescription)
    errors.push('Load error: ' + errorDescription)
  })

  win.webContents.on('preload-error', (_event, _preloadPath, error) => {
    console.error('[Preload Error]', error)
    errors.push('Preload error: ' + error)
  })

  win.webContents.setFrameRate(30)

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['']
      }
    })
  })

  const url = `http://localhost:${port}/index.html`
  console.log('[Main] Loading:', url)
  await win.loadURL(url)
  console.log('[Main] Page loaded, waiting for React...')

  const appReady = await waitForApp(win)
  if (!appReady) {
    console.error('[FAIL] App did not render — aborting')
    server.close()
    app.exit(1)
    return
  }

  let failures = 0
  let step = 1

  // Screenshot each view via nav buttons
  for (let i = 0; i < views.length; i++) {
    const view = views[i]

    try {
      const result = await win.webContents.executeJavaScript(`
        (() => {
          const buttons = document.querySelectorAll('nav button');
          if (buttons[${i}]) {
            buttons[${i}].click();
            return 'clicked nav ' + ${i} + ': ' + buttons[${i}].textContent;
          }
          return 'no nav button at index ${i}, total: ' + buttons.length;
        })()
      `)
      console.log('[Nav]', result)
    } catch (err) {
      console.log('[Nav Error]', err.message)
    }

    const name = String(step++).padStart(2, '0') + '-' + view
    const png = await captureScreenshot(win, name)
    if (!validateScreenshot(png, name)) failures++

    // Run any post-navigation interactions for this view
    const viewInteractions = interactions[view] || []
    for (const interaction of viewInteractions) {
      // Send stateSync updates if the interaction specifies them
      if (interaction.stateUpdates) {
        win.webContents.send(
          'main:action',
          'stateSync',
          JSON.stringify([{ updates: interaction.stateUpdates }])
        )
        await new Promise(r => setTimeout(r, 500)) // wait for React to re-render
      }

      try {
        const result = await win.webContents.executeJavaScript(interaction.js)
        console.log(`[Interact:${interaction.name}]`, result)
      } catch (err) {
        console.log(`[Interact Error:${interaction.name}]`, err.message)
      }

      const interName = String(step++).padStart(2, '0') + '-' + interaction.name
      const interPng = await captureScreenshot(win, interName)
      if (!validateScreenshot(interPng, interName)) failures++
    }
  }

  // Light-mode screenshots: toggle colorway to 'light' and capture key views
  console.log('\n[Light Mode] Switching colorway to light...')
  win.webContents.send(
    'main:action',
    'stateSync',
    JSON.stringify([{ updates: [{ path: 'main.colorway', value: 'light' }] }])
  )
  // Wait for React to re-render with the new colorway
  await new Promise(r => setTimeout(r, 800))

  const lightViews = [
    { name: 'accounts', navIndex: 0 },
    { name: 'portfolio', navIndex: 1 },
    { name: 'send', navIndex: 2 },
    { name: 'history', navIndex: 5 },
    { name: 'chains', navIndex: 6 },
    { name: 'tokens', navIndex: 7 },
    { name: 'signers', navIndex: 4 },
    { name: 'settings', navIndex: 8 }
  ]

  for (const { name: lightViewName, navIndex } of lightViews) {
    try {
      const result = await win.webContents.executeJavaScript(`
        (() => {
          const buttons = document.querySelectorAll('nav button');
          if (buttons[${navIndex}]) {
            buttons[${navIndex}].click();
            return 'clicked nav ${navIndex}: ' + buttons[${navIndex}].textContent;
          }
          return 'no nav button at index ${navIndex}, total: ' + buttons.length;
        })()
      `)
      console.log('[Light Nav]', result)
    } catch (err) {
      console.log('[Light Nav Error]', err.message)
    }

    const lightName = String(step++).padStart(2, '0') + '-light-' + lightViewName
    const lightPng = await captureScreenshot(win, lightName)
    if (!validateScreenshot(lightPng, lightName)) failures++
  }

  // Compact-mode screenshots: resize window to narrow width and capture key views
  console.log('\n[Compact Mode] Resizing window to 400x800...')
  // Switch back to dark colorway for compact screenshots
  win.webContents.send(
    'main:action',
    'stateSync',
    JSON.stringify([{ updates: [{ path: 'main.colorway', value: 'dark' }] }])
  )
  win.setContentSize(400, 800)
  // Wait for React to re-render with compact layout
  await new Promise(r => setTimeout(r, 800))

  const compactViews = [
    { name: 'accounts', navIndex: 0 },
    { name: 'portfolio', navIndex: 1 },
    { name: 'chains', navIndex: 6 },
    { name: 'settings', navIndex: 8 }
  ]

  for (const { name: compactViewName, navIndex } of compactViews) {
    try {
      const result = await win.webContents.executeJavaScript(`
        (() => {
          const buttons = document.querySelectorAll('nav button');
          if (buttons[${navIndex}]) {
            buttons[${navIndex}].click();
            return 'clicked nav ${navIndex}: ' + buttons[${navIndex}].textContent;
          }
          return 'no nav button at index ${navIndex}, total: ' + buttons.length;
        })()
      `)
      console.log('[Compact Nav]', result)
    } catch (err) {
      console.log('[Compact Nav Error]', err.message)
    }

    const compactName = String(step++).padStart(2, '0') + '-compact-' + compactViewName
    const compactPng = await captureScreenshot(win, compactName)
    if (!validateScreenshot(compactPng, compactName)) failures++
  }

  // Reset window size back to original
  console.log('[Compact Mode] Resetting window to 1200x800...')
  win.setContentSize(1200, 800)
  await new Promise(r => setTimeout(r, 500))

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log(`Screenshots: ${step - 1} captured, ${failures} failures`)
  if (errors.length > 0) {
    console.log(`Renderer errors: ${errors.length}`)
    errors.forEach(e => console.log('  -', e.substring(0, 120)))
  }
  console.log('='.repeat(60))

  server.close()
  app.exit(failures > 0 ? 1 : 0)
})

app.on('window-all-closed', () => app.quit())
