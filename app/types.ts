/**
 * Renderer-side type definitions.
 *
 * These mirror the main process state shape but are defined independently
 * to avoid importing Node-only code into the renderer bundle. Types that
 * exist in main/store/state/types/ or main/accounts/types.ts are kept
 * compatible but not re-exported (they pull in Node dependencies).
 */

// --- Accounts ---

export interface Account {
  id: string
  name: string
  address: string
  status: string
  signer: string
  requests: Record<string, AccountRequest>
  ensName?: string
  created?: string
}

export interface AccountMetadata {
  name?: string
}

// --- Signers ---

export type SignerType = 'ring' | 'seed' | 'trezor' | 'ledger' | 'lattice'

export interface Signer {
  id: string
  type: SignerType | string
  name: string
  status: string
  addresses: string[]
  model?: string
  createdAt?: number
  live?: boolean
}

// --- Chains / Networks ---

export interface NetworkConnection {
  on: boolean
  current: string
  status: string
  connected: boolean
  custom: string
  type: string
  network: string
}

export interface Chain {
  id: number
  type: string
  name: string
  layer?: string
  isTestnet: boolean
  on: boolean
  explorer: string
  symbol?: string
  connection: {
    primary: NetworkConnection
    secondary: NetworkConnection
  }
}

export interface GasLevels {
  slow: string
  standard: string
  fast: string
  asap: string
  custom: string
}

export interface ChainMetadata {
  blockHeight?: number
  icon?: string
  primaryColor?: string
  nativeCurrency: {
    symbol: string
    name: string
    icon: string
    decimals: number
    usd: {
      price: number
      change24hr: number
    }
  }
  gas: {
    price: {
      selected: string
      levels: GasLevels
    }
  }
  rpcHealth?: RpcHealth
}

// --- Tokens ---

export interface Token {
  address: string
  chainId: number
  name: string
  symbol: string
  decimals: number
  logoURI?: string
}

// --- Balances ---

export interface Balance {
  address: string
  chainId: number
  name: string
  symbol: string
  decimals: number
  balance: string
  displayBalance: string
}

// --- Origins & Permissions ---

export interface Origin {
  chain: { id: number; type: string }
  name: string
  session: {
    requests: number
    startedAt: number
    endedAt?: number
    lastUpdatedAt: number
  }
}

export interface Permission {
  origin: string
  provider: boolean
  handlerId: string
}

// --- Requests ---

export type RequestType =
  | 'sign'
  | 'signTypedData'
  | 'signErc20Permit'
  | 'transaction'
  | 'access'
  | 'addChain'
  | 'switchChain'
  | 'addToken'

export type RequestStatus =
  | 'pending'
  | 'sending'
  | 'verifying'
  | 'confirming'
  | 'confirmed'
  | 'sent'
  | 'declined'
  | 'error'
  | 'success'

export interface AccountRequest {
  type: RequestType
  handlerId: string
  origin: string
  account: string
  status?: RequestStatus
  notice?: string
  created?: number
  payload?: {
    method: string
    params?: unknown[]
    jsonrpc: string
    id: number
  }
  // Transaction-specific
  data?: TransactionData
  chainData?: { optimism?: { l1Fees: string } }
  decodedData?: { name: string; signature: string; args: Record<string, string> }
  tx?: { hash?: string; receipt?: { gasUsed: string; blockNumber: string }; confirmations: number }
  approvals?: Array<{ type: string; data: unknown; approved: boolean }>
  automaticFeeUpdateNotice?: { previousFee: unknown }
  feesUpdatedByUser?: boolean
  recognizedActions?: Array<{ type: string; data?: unknown }>
  recipientType?: string
  // Signature-specific
  typedMessage?: { data: unknown; version: string }
  permit?: PermitData
  tokenData?: { name: string; symbol: string; decimals: number }
  // Access-specific (no extra fields)
  // Chain/token-specific
  chain?: { id: number; type: string; name: string }
  token?: Token
}

export interface TransactionData {
  to: string
  from?: string
  value: string
  data?: string
  chainId: string
  gasLimit?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
  gasPrice?: string
  nonce?: string
  type?: string
}

export interface PermitData {
  deadline: string | number
  spender: { address: string; ens: string; type: string }
  value: string | number
  owner: string
  verifyingContract: { address: string; ens: string; type: string }
  chainId: number
  nonce: string | number
}

// --- RPC Health ---

export interface RpcHealth {
  latencyMs: number
  lastChecked: number
  status: 'healthy' | 'degraded' | 'down'
  consecutiveErrors: number
}

// --- Settings ---

export interface Shortcut {
  modifierKeys: string[]
  shortcutKey: string
  enabled: boolean
  configuring: boolean
}
