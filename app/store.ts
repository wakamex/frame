import { proxy, useSnapshot } from 'valtio'
import type {
  Account,
  AccountMetadata,
  AccountRequest,
  AddressBookEntry,
  Balance,
  Chain,
  ChainMetadata,
  GasAlert,
  GasLevels,
  Origin,
  Permission,
  Shortcut,
  Signer,
  Token,
  TxRecord
} from './types'

export interface MainState {
  _version: number
  instanceId: string
  apiKeys: { etherscan: string; polygonscan: string; arbiscan: string }
  colorway: 'light' | 'dark'
  launch: boolean
  reveal: boolean
  autohide: boolean
  menubarGasPrice: boolean
  showLocalNameWithENS: boolean
  mute: Record<string, boolean>
  shortcuts: {
    summon: Shortcut
  }
  networks: {
    ethereum: Record<string, Chain>
  }
  networksMeta: {
    ethereum: Record<string, ChainMetadata>
  }
  accounts: Record<string, Account>
  accountsMeta: Record<string, AccountMetadata>
  addressBook: Record<string, AddressBookEntry>
  origins: Record<string, Origin>
  permissions: Record<string, Record<string, Permission>>
  balances: Record<string, Balance[]>
  tokens: { custom: Token[]; known: Record<string, Token> }
  signers: Record<string, Signer>
  savedSigners: Record<string, Signer>
  lattice: Record<string, unknown>
  latticeSettings: {
    accountLimit: number
    derivation: string
    endpointMode: string
    endpointCustom: string
  }
  ledger: {
    derivation: string
    liveAccountLimit: number
  }
  trezor: {
    derivation: string
  }
  showBuyButton: boolean
  privacy: {}
  updater: {
    dontRemind: string[]
    badge?: { type: string; version: string }
  }
  gasAlerts: Record<string, GasAlert>
  txHistory: Record<string, TxRecord[]>
}

export interface AppState {
  // Main process state (synced from main)
  main: MainState
  platform: string

  // Local UI state
  initialized: boolean
  currentView:
    | 'accounts'
    | 'portfolio'
    | 'signers'
    | 'chains'
    | 'settings'
    | 'send'
    | 'tokens'
    | 'contacts'
    | 'history'
  selectedAccount: string | null
}

// The reactive state proxy for the renderer
export const state = proxy<AppState>({
  main: {} as MainState,
  platform: '',
  initialized: false,
  currentView: 'accounts',
  selectedAccount: null
})

// Initialize with full state from main process
export function initializeState(data: { main: MainState; platform: string }) {
  state.main = data.main
  state.platform = data.platform
  state.initialized = true
}

// Apply incremental state updates from main process
function setByPath(obj: any, keys: string[], value: unknown) {
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined) obj[keys[i]] = {}
    obj = obj[keys[i]]
  }
  obj[keys[keys.length - 1]] = value
}

export function applyUpdates(updates: Array<{ path: string; value: unknown }>) {
  for (const { path, value } of updates) {
    setByPath(state, path.split('.'), value)
  }
}

// Local UI actions
export function setView(view: AppState['currentView']) {
  state.currentView = view
}

export function setSelectedAccount(id: string | null) {
  state.selectedAccount = id
}

// Typed selector hooks (use useSnapshot for automatic fine-grained reactivity)
export const useMainState = () => useSnapshot(state).main
export const useNetworks = () => useSnapshot(state).main?.networks?.ethereum ?? {}
export const useNetworksMeta = () => useSnapshot(state).main?.networksMeta?.ethereum ?? {}
export const useAccounts = () => useSnapshot(state).main?.accounts ?? {}
export const useSigners = () => useSnapshot(state).main?.signers ?? {}
export const useSavedSigners = () => useSnapshot(state).main?.savedSigners ?? {}
export const useCurrentView = () => useSnapshot(state).currentView
export const useBalances = (address: string) => useSnapshot(state).main?.balances?.[address] ?? []
export const useTokens = () => useSnapshot(state).main?.tokens ?? { custom: [], known: {} }
export const usePermissions = (address: string) => useSnapshot(state).main?.permissions?.[address] ?? {}
export const useOrigins = () => useSnapshot(state).main?.origins ?? {}
export const usePlatform = () => useSnapshot(state).platform
export const useColorway = () => useSnapshot(state).main?.colorway ?? 'dark'
export const useSelectedAccount = () => {
  const snap = useSnapshot(state)
  const id = snap.selectedAccount
  if (!id || !snap.main?.accounts) return null
  return snap.main.accounts[id] ?? null
}
export const useAccountsMeta = () => useSnapshot(state).main?.accountsMeta ?? {}
export const useAllBalances = () => useSnapshot(state).main?.balances ?? {}
export const useGasAlerts = () => useSnapshot(state).main?.gasAlerts ?? {}

// Derived selectors for requests across all accounts
export const usePendingRequests = () => {
  const snap = useSnapshot(state)
  const accounts = snap.main?.accounts ?? {}
  const requests: AccountRequest[] = []
  for (const account of Object.values(accounts)) {
    const accountRequests = (account as any)?.requests ?? {}
    for (const req of Object.values(accountRequests)) {
      requests.push(req as AccountRequest)
    }
  }
  return requests.filter((r) => r && !['confirmed', 'declined', 'error', 'success'].includes(r.status ?? ''))
}

export const useTxHistory = (address?: string) => {
  const snap = useSnapshot(state)
  if (!address) return []
  return snap.main?.txHistory?.[address.toLowerCase()] ?? []
}

export const useAddressBook = () => useSnapshot(state).main?.addressBook ?? {}

// Re-export useSnapshot for components that need direct access
export { useSnapshot }
