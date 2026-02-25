import { create } from 'zustand'
import type {
  Account,
  AccountMetadata,
  AccountRequest,
  Balance,
  Chain,
  ChainMetadata,
  GasLevels,
  Origin,
  Permission,
  Shortcut,
  Signer,
  Token
} from './types'

export interface MainState {
  _version: number
  instanceId: string
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
  privacy: {
    errorReporting: boolean
  }
  updater: {
    dontRemind: string[]
    badge?: { type: string; version: string }
  }
}

export interface AppState {
  // Main process state (synced from main)
  main: MainState
  platform: string

  // Local UI state
  initialized: boolean
  currentView: 'accounts' | 'signers' | 'chains' | 'settings' | 'send' | 'tokens'
  selectedAccount: string | null

  // Actions
  initialize: (state: { main: MainState; platform: string }) => void
  applyUpdates: (updates: Array<{ path: string; value: unknown }>) => void
  setView: (view: AppState['currentView']) => void
  setSelectedAccount: (id: string | null) => void
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  const result = { ...obj } as Record<string, unknown>
  let current = result as Record<string, unknown>

  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) }
    current = current[keys[i]] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
  return result
}

export const useStore = create<AppState>((set) => ({
  // Initial state (populated by IPC on startup)
  main: {} as MainState,
  platform: '',

  // Local UI state
  initialized: false,
  currentView: 'accounts',
  selectedAccount: null,

  // Initialize with full state from main process
  initialize: (state) =>
    set({
      main: state.main,
      platform: state.platform,
      initialized: true
    }),

  // Apply incremental state updates from main process
  applyUpdates: (updates) =>
    set((prev) => {
      let next = { ...prev } as Record<string, unknown>
      for (const update of updates) {
        next = setNestedValue(next, update.path, update.value)
      }
      return next as AppState
    }),

  // Local UI actions
  setView: (view) => set({ currentView: view }),
  setSelectedAccount: (id) => set({ selectedAccount: id })
}))

// Typed selector helpers
export const useMainState = () => useStore((s) => s.main)
export const useNetworks = () => useStore((s) => s.main?.networks?.ethereum ?? {})
export const useNetworksMeta = () => useStore((s) => s.main?.networksMeta?.ethereum ?? {})
export const useAccounts = () => useStore((s) => s.main?.accounts ?? {})
export const useSigners = () => useStore((s) => s.main?.signers ?? {})
export const useSavedSigners = () => useStore((s) => s.main?.savedSigners ?? {})
export const useCurrentView = () => useStore((s) => s.currentView)
export const useBalances = (address: string) =>
  useStore((s) => s.main?.balances?.[address] ?? [])
export const useTokens = () => useStore((s) => s.main?.tokens ?? { custom: [], known: {} })
export const usePermissions = (address: string) =>
  useStore((s) => s.main?.permissions?.[address] ?? {})
export const useOrigins = () => useStore((s) => s.main?.origins ?? {})
export const usePlatform = () => useStore((s) => s.platform)
export const useColorway = () => useStore((s) => s.main?.colorway ?? 'dark')
export const useSelectedAccount = () =>
  useStore((s) => {
    const id = s.selectedAccount
    if (!id || !s.main?.accounts) return null
    return s.main.accounts[id] ?? null
  })
export const useAccountsMeta = () => useStore((s) => s.main?.accountsMeta ?? {})

// Derived selectors for requests across all accounts
export const usePendingRequests = () =>
  useStore((s) => {
    const accounts = s.main?.accounts ?? {}
    const requests: AccountRequest[] = []
    for (const account of Object.values(accounts)) {
      const accountRequests = account?.requests ?? {}
      for (const req of Object.values(accountRequests)) {
        requests.push(req)
      }
    }
    return requests.filter(
      (r) => r && !['confirmed', 'declined', 'error', 'success'].includes(r.status ?? '')
    )
  })
