/**
 * Test mock for main/store.
 *
 * The real store exports a valtio proxy (plain object with reactive wrapper).
 * This mock is a callable function (for backward compat with tests that use
 * store('main.path')) that also works as a plain object (state.main.xxx).
 *
 * Usage in tests:
 *   import state from '../../store'   // gets this mock
 *   state.main.accounts['0x1'] = { id: '0x1', name: 'Test' }  // set up state
 *   state('main.accounts', '0x1')  // legacy path-based getter
 *   state.__clear()  // reset to defaults between tests
 */

function createDefaultState(): any {
  return {
    main: {
      _version: 42,
      instanceId: 'test-instance',
      colorway: 'dark',
      launch: false,
      reveal: false,
      autohide: false,
      menubarGasPrice: false,
      showLocalNameWithENS: false,
      accountCloseLock: false,
      mute: {
        alphaWarning: false,
        welcomeWarning: false,
        explorerWarning: false,
        gasFeeWarning: false,
        betaDisclosure: false,
        onboardingWindow: false,
        signerCompatibilityWarning: false
      },
      shortcuts: {
        summon: { modifierKeys: ['Alt'], shortcutKey: 'Slash', enabled: true, configuring: false }
      },
      networks: { ethereum: {} },
      networksMeta: { ethereum: {} },
      accounts: {},
      accountsMeta: {},
      origins: {},
      permissions: {},
      balances: {},
      tokens: { custom: [], known: {} },
      rates: {},
      signers: {},
      savedSigners: {},
      lattice: {},
      latticeSettings: { accountLimit: 5, derivation: 'standard', endpointMode: 'default', endpointCustom: '' },
      ledger: { derivation: 'live', liveAccountLimit: 5 },
      trezor: { derivation: 'standard' },
      privacy: { errorReporting: true },
      knownExtensions: {},
      updater: { dontRemind: [], badge: null },
      ipfs: {},
      addresses: {}
    },
    selected: {
      current: '',
      open: false,
      minimized: true,
      view: 'default',
      showAccounts: false,
      settings: { viewIndex: 0, views: ['permissions', 'verify', 'control'], subIndex: 0 },
      addresses: [],
      requests: {}
    },
    windows: {
      panel: { show: false, nav: [], footer: { height: 40 } },
      dash: { show: false, nav: [], footer: { height: 40 } }
    },
    panel: { accountFilter: '' },
    platform: process.platform
  }
}

// Resolve a dotted path through an object
function getByPath(obj: any, ...args: any[]): any {
  const parts = args.flatMap((seg: any) => String(seg).split('.'))
  let current = obj
  for (const part of parts) {
    if (current === undefined || current === null) return undefined
    current = current[part]
  }
  return current
}

// Set a value at a dotted path
function setByPath(obj: any, parts: string[], value: any) {
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {}
    }
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}

// Create a callable state object using a Proxy
// This allows both: state.main.xxx AND state('main.xxx')
const stateData: any = createDefaultState()

// The callable function — resolves path segments like store('main.networks', 'ethereum', 1)
function storeFunction(...args: any[]): any {
  return getByPath(stateData, ...args)
}

// Create a Proxy that forwards property access to stateData but also supports function calls
const state: any = new Proxy(storeFunction, {
  get(_target, prop) {
    // Special helpers
    if (prop === '__clear') return clearState
    if (prop === 'clear') return clearState
    if (prop === 'set') return setState
    if (prop === 'observer') return observerFn
    if (prop === 'getObserver') return getObserverFn
    if (prop === '__observers') return observers
    // Forward everything else to stateData
    return stateData[prop]
  },
  set(_target, prop, value) {
    stateData[prop] = value
    return true
  },
  apply(_target, _thisArg, args) {
    return getByPath(stateData, ...args)
  }
})

// ---- Test helpers ----

let observers: Record<string, any> = {}

function clearState() {
  const defaults = createDefaultState()
  for (const key of Object.keys(defaults)) {
    stateData[key] = defaults[key]
  }
  // Clear any extra keys
  for (const key of Object.keys(stateData)) {
    if (!(key in defaults)) delete stateData[key]
  }
  observers = {}
}

// Legacy path-based setter: state.set('main.signers', id, signer)
function setState(...args: any[]) {
  const value = args[args.length - 1]
  const pathParts = args.slice(0, -1).flatMap((seg: any) => String(seg).split('.'))
  setByPath(stateData, pathParts, value)
}

// Legacy observer
function observerFn(cb: () => void, id?: string) {
  const observer = {
    fire: () => cb(),
    remove: () => {
      if (id) delete observers[id]
    }
  }
  if (id) observers[id] = observer
  return observer
}

function getObserverFn(id: string) {
  return observers[id]
}

module.exports = state
module.exports.default = state
