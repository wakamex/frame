import link from '../resources/link'
import { initializeState, applyUpdates } from './store'
import type { Token, AccountRequest } from './types'

// Initialize the renderer: fetch full state from main, subscribe to updates
export function initializeApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    link.rpc('getState', (err: Error | null, state: unknown) => {
      if (err) {
        reject(new Error('Could not get initial state from main process'))
        return
      }

      // Populate valtio proxy with initial state
      initializeState(state as Parameters<typeof initializeState>[0])

      // Listen for incremental state updates from main process
      link.on('action', (action: string, ...args: unknown[]) => {
        if (action === 'stateSync') {
          try {
            const actionBatch = JSON.parse(args[0] as string)
            const updates: Array<{ path: string; value: unknown }> = []
            for (const actionItem of actionBatch) {
              for (const update of actionItem.updates) {
                updates.push({ path: update.path, value: update.value })
              }
            }
            applyUpdates(updates)
          } catch (e) {
            console.error('State sync error', e)
          }
        }
      })

      // Signal to main process that renderer is ready
      link.send('tray:ready')

      resolve()
    })
  })
}

// Send an action to the main process store
export function sendAction(action: string, ...args: unknown[]) {
  link.send('tray:action', action, ...args)
}

// Send an IPC event to the main process
export function sendEvent(channel: string, ...args: unknown[]) {
  link.send(channel, ...args)
}

// Invoke an IPC method on the main process and await a response
export function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return link.invoke(channel, ...args)
}

// RPC call to main process with callback
export function rpc(method: string, ...args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    link.rpc(method, ...args, (err: Error | null, result: unknown) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

// Typed action helpers for common operations
export const actions = {
  // Clipboard
  clipboardData: (data: string) => sendEvent('tray:clipboardData', data),

  // Request management
  resolveRequest: (req: AccountRequest, result?: unknown) => sendEvent('tray:resolveRequest', req, result),
  rejectRequest: (req: AccountRequest) => sendEvent('tray:rejectRequest', req),
  approveRequest: (req: AccountRequest) => rpc('approveRequest', req),
  declineRequest: (req: AccountRequest) => rpc('declineRequest', req),
  confirmRequestApproval: (req: AccountRequest, type: string, data: unknown) =>
    rpc('confirmRequestApproval', req, type, data),
  updateRequest: (reqId: string, data: Record<string, unknown>, actionId: string) =>
    rpc('updateRequest', reqId, data, actionId),

  // Gas fee controls
  setBaseFee: (fee: string, handlerId: string) => rpc('setBaseFee', fee, handlerId),
  setPriorityFee: (fee: string, handlerId: string) => rpc('setPriorityFee', fee, handlerId),
  setGasPrice: (price: string, handlerId: string) => rpc('setGasPrice', price, handlerId),
  setGasLimit: (limit: string, handlerId: string) => rpc('setGasLimit', limit, handlerId),
  removeFeeUpdateNotice: (handlerId: string) => rpc('removeFeeUpdateNotice', handlerId),

  // Account management
  removeAccount: (id: string) => sendEvent('tray:removeAccount', id),
  renameAccount: (id: string, name: string) => sendEvent('tray:renameAccount', id, name),
  giveAccess: (req: AccountRequest, access: boolean) => sendEvent('tray:giveAccess', req, access),
  clearRequestsByOrigin: (account: string, origin: string) =>
    sendEvent('tray:clearRequestsByOrigin', account, origin),

  // Signer creation
  createFromPhrase: (phrase: string, password: string) => rpc('createFromPhrase', phrase, password),
  createFromPrivateKey: (privateKey: string, password: string) =>
    rpc('createFromPrivateKey', privateKey, password),
  createFromKeystore: (
    keystore: Record<string, unknown> | null,
    password: string,
    keystorePassword: string
  ) => rpc('createFromKeystore', keystore, password, keystorePassword),
  createFromAddress: (address: string, name: string) => rpc('createFromAddress', address, name),
  createAccount: (address: string, name: string, options: Record<string, unknown>) =>
    rpc('createAccount', address, name, options),
  locateKeystore: () => rpc('locateKeystore') as Promise<Record<string, unknown>>,

  // Signer management
  setSigner: (id: string) => rpc('setSigner', id),
  unsetSigner: (id: string) => rpc('unsetSigner', id),
  unlockSigner: (id: string, password: string) => rpc('unlockSigner', id, password),
  lockSigner: (id: string) => rpc('lockSigner', id),
  removeSigner: (id: string) => sendEvent('dash:removeSigner', id),
  reloadSigner: (id: string) => sendEvent('dash:reloadSigner', id),
  verifyAddress: () => rpc('verifyAddress'),

  // Lattice
  createLattice: (deviceId: string, deviceName: string) => rpc('createLattice', deviceId, deviceName),
  latticePair: (id: string, pin: string) => rpc('latticePair', id, pin),

  // Trezor
  trezorPin: (id: string, pin: string) => rpc('trezorPin', id, pin),
  trezorPhrase: (id: string, phrase: string) => rpc('trezorPhrase', id, phrase),

  // Navigation & external
  openExternal: (url: string) => sendEvent('tray:openExternal', url),
  openExplorer: (chain: { type: string; id: number }, hash?: string, account?: string) =>
    sendEvent('tray:openExplorer', chain, hash, account),

  // Chain management
  addChain: (chain: Record<string, unknown>) => sendEvent('tray:addChain', chain),
  switchChain: (type: string, id: number, req?: AccountRequest) =>
    sendEvent('tray:switchChain', type, id, req),

  // Token management
  addToken: (token: Partial<Token> & { address: string; chainId: number }, req?: AccountRequest) =>
    sendEvent('tray:addToken', token, req),
  removeToken: (token: Token) => sendEvent('tray:removeToken', token),
  getTokenDetails: (contractAddress: string, chainId: number) =>
    invoke<{ name: string; symbol: string; decimals: number }>(
      'tray:getTokenDetails',
      contractAddress,
      chainId
    ),

  // Settings
  syncPath: (path: string, value: unknown) => sendEvent('tray:syncPath', path, value),

  // Origins
  removeOrigin: (handlerId: string) => sendEvent('tray:removeOrigin', handlerId),
  clearOrigins: () => sendEvent('tray:clearOrigins'),

  // Updates
  installUpdate: () => sendEvent('tray:installAvailableUpdate'),
  dismissUpdate: (version: string, remind: boolean) => sendEvent('tray:dismissUpdate', version, remind),
  resetAllSettings: () => sendEvent('tray:resetAllSettings'),

  // ENS
  resolveEnsName: (name: string) => rpc('resolveEnsName', name) as Promise<string | null>,

  // Chain discovery
  fetchChainlist: () => invoke<any[]>('tray:fetchChainlist')
}
