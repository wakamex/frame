import fs from 'fs'
import { ipcMain } from 'electron'
import log from 'electron-log'
import { randomBytes } from 'crypto'
import { isAddress } from 'viem'
import { snapshot } from 'valtio'
import { openFileDialog, openCsvFileDialog } from '../windows/dialog'
import { openBlockExplorer } from '../windows/window'

import accounts from '../accounts'
import signers from '../signers'
import * as launch from '../launch'
import provider from '../provider'
import state from '../store'
import { updateLattice, trustExtension, addTxRecord } from '../store/actions'
import txTracker from '../txHistory'
import { resolveName } from '../ens'

import { arraysEqual, randomLetters } from '../../resources/utils'
import { isSignatureRequest } from '../signatures'
import TrezorBridge from '../../main/signers/trezor/bridge'

type RpcCallback = (...args: any[]) => void

const callbackWhenDone = (fn: () => void, cb: RpcCallback) => {
  try {
    fn()
    cb(null)
  } catch (e) {
    cb(e)
  }
}

const rpc: Record<string, (...args: any[]) => void> = {
  getState: (cb: RpcCallback) => {
    cb(null, snapshot(state))
  },
  signTransaction: accounts.signTransaction,
  signMessage: accounts.signMessage,
  getAccounts: accounts.getAccounts,
  getCoinbase: accounts.getCoinbase,
  setSigner: (id: string, cb: RpcCallback) => {
    const previousAddresses = accounts.getSelectedAddresses()

    accounts.setSigner(id, cb)

    const currentAddresses = accounts.getSelectedAddresses()

    if (!arraysEqual(previousAddresses, currentAddresses)) {
      provider.accountsChanged(currentAddresses)
    }
  },
  unsetSigner: (_id: string, cb: RpcCallback) => {
    const previousAddresses = accounts.getSelectedAddresses()

    accounts.unsetSigner(cb)

    const currentAddresses = accounts.getSelectedAddresses()

    if (!arraysEqual(previousAddresses, currentAddresses)) {
      provider.accountsChanged(currentAddresses)
    }
  },
  trezorPin: (id: string, pin: string, cb: RpcCallback) => {
    cb()
    TrezorBridge.pinEntered(id, pin)
  },
  trezorPhrase: (id: string, phrase: string, cb: RpcCallback) => {
    cb()
    TrezorBridge.passphraseEntered(id, phrase)
  },
  trezorEnterPhrase: (id: string, cb: RpcCallback) => {
    cb()
    TrezorBridge.enterPassphraseOnDevice(id)
  },
  createLattice: (deviceId: string, deviceName: string, cb: RpcCallback) => {
    if (!deviceId) {
      return cb(new Error('No Device ID'))
    }

    updateLattice(deviceId, {
      deviceId,
      baseUrl: 'https://signing.gridpl.us',
      endpointMode: 'default',
      paired: true,
      deviceName: (deviceName || 'GridPlus').substring(0, 14),
      tag: randomLetters(6),
      privKey: randomBytes(32).toString('hex')
    })

    cb(null, { id: 'lattice-' + deviceId })
  },
  async latticePair(id: string, pin: string, cb: RpcCallback) {
    const signer = signers.get(id)

    if (signer && (signer as any).pair) {
      try {
        const hasActiveWallet = await (signer as any).pair(pin)
        cb(null, hasActiveWallet)
      } catch (e: any) {
        cb(e.message)
      }
    }
  },
  launchStatus: launch.status,
  providerSend: (payload: any, cb: RpcCallback) => provider.send(payload, cb),
  connectionStatus: (cb: RpcCallback) => {
    cb(null, {
      primary: {
        status: (provider.connection as any).primary?.status,
        network: (provider.connection as any).primary?.network,
        type: (provider.connection as any).primary?.type,
        connected: (provider.connection as any).primary?.connected
      },
      secondary: {
        status: (provider.connection as any).secondary?.status,
        network: (provider.connection as any).secondary?.network,
        type: (provider.connection as any).secondary?.type,
        connected: (provider.connection as any).secondary?.connected
      }
    })
  },
  confirmRequestApproval(req: any, approvalType: string, approvalData: any) {
    accounts.confirmRequestApproval(req.handlerId, approvalType as any, approvalData)
  },
  respondToExtensionRequest(id: string, approved: boolean, cb: RpcCallback) {
    callbackWhenDone(() => trustExtension(id, approved), cb)
  },
  updateRequest(reqId: string, data: any, actionId: string) {
    accounts.updateRequest(reqId, data, actionId as any)
  },
  approveRequest(req: any) {
    accounts.setRequestPending(req)
    if (req.type === 'transaction') {
      provider.approveTransactionRequest(req, (err: any, txHash: any) => {
        if (err) return accounts.setRequestError(req.handlerId, err)

        // Record transaction in history
        if (txHash && req.data) {
          const chainId = parseInt(req.data.chainId, 16) || 1
          const from = (req.data.from || req.account || '').toLowerCase()
          const record = {
            hash: txHash,
            chainId,
            from,
            to: req.data.to || '',
            value: req.data.value || '0x0',
            data: req.data.data,
            decodedName: req.decodedData?.name || req.recognizedActions?.[0]?.type,
            status: 'pending',
            submittedAt: Date.now()
          }
          addTxRecord(from, record)
          txTracker.track(txHash, chainId, from)
        }

        setTimeout(() => accounts.setTxSent(req.handlerId, txHash), 1800)
      })
    } else if (req.type === 'sign') {
      provider.approveSign(req, (err: any, res: any) => {
        if (err) return accounts.setRequestError(req.handlerId, err)
        accounts.setRequestSuccess(req.handlerId)
      })
    } else if (req.type === 'signTypedData' || req.type === 'signErc20Permit') {
      provider.approveSignTypedData(req, (err: any, res: any) => {
        if (err) return accounts.setRequestError(req.handlerId, err)
        accounts.setRequestSuccess(req.handlerId)
      })
    }
  },
  declineRequest(req: any) {
    if (req.type === 'transaction' || isSignatureRequest(req)) {
      accounts.declineRequest(req.handlerId)
      provider.declineRequest(req)
    }
  },
  createFromAddress(address: string, name: string, cb: RpcCallback) {
    if (!isAddress(address)) return cb(new Error('Invalid Address'))
    accounts.add(address, name, { type: 'Address' })
    cb()
  },
  createAccount(address: string, name: string, options: any, cb: RpcCallback) {
    if (!isAddress(address)) return cb(new Error('Invalid Address'))
    accounts.add(address, name, options)
    cb()
  },
  removeAccount(address: string, _options: any, cb: RpcCallback) {
    accounts.remove(address)
    cb()
  },
  async loadWatchList(source: string, cb: RpcCallback) {
    try {
      let csv: string

      if (source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetch(source)
        if (!res.ok) return cb(new Error(`Failed to fetch: ${res.status} ${res.statusText}`))
        csv = await res.text()
      } else {
        // Source is 'file' — open a file dialog
        const file = await openCsvFileDialog()
        if (!file || file.canceled || !file.filePaths.length) return cb(new Error('No file selected'))
        csv = fs.readFileSync(file.filePaths[0], 'utf8')
      }

      const lines = csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))

      if (!lines.length) return cb(new Error('CSV file is empty'))

      // Detect if first line is a header
      const firstFields = lines[0].split(',').map((f) => f.trim().toLowerCase())
      const hasHeader = firstFields.includes('name') || firstFields.includes('address')
      const dataLines = hasHeader ? lines.slice(1) : lines

      const results: Array<{ name: string; address: string; error?: string }> = []
      const added = new Set<string>()

      for (const line of dataLines) {
        const parts = line.split(',').map((p) => p.trim())
        if (parts.length < 2) {
          results.push({ name: parts[0] || '', address: '', error: 'Invalid row format' })
          continue
        }

        const [name, address] = parts

        if (!isAddress(address)) {
          results.push({ name, address, error: `Invalid address: ${address}` })
          continue
        }

        const normalized = address.toLowerCase()
        if (added.has(normalized)) {
          results.push({ name, address })
          continue
        }
        added.add(normalized)

        accounts.add(address, name, { type: 'Address' })
        results.push({ name, address })
      }

      cb(null, results)
    } catch (err) {
      cb(err)
    }
  },
  createFromPhrase(phrase: string, password: string, cb: RpcCallback) {
    signers.createFromPhrase(phrase, password, cb)
  },
  async locateKeystore(cb: RpcCallback) {
    try {
      const file = await openFileDialog()
      const keystore = file || { filePaths: [] }
      if ((keystore.filePaths || []).length > 0) {
        fs.readFile(keystore.filePaths[0], 'utf8', (err, data) => {
          if (err) return cb(err)
          try {
            const parsed = JSON.parse(data)
            if (typeof parsed.version !== 'number') cb('Invalid keystore file')
            if (![1, 3].includes(parsed.version)) cb('Invalid keystore version')
            cb(null, parsed)
          } catch (err) {
            cb(err)
          }
        })
      } else {
        cb(new Error('No Keystore Found'))
      }
    } catch (e) {
      cb(e)
    }
  },
  createFromKeystore(keystore: any, password: string, keystorePassword: string, cb: RpcCallback) {
    signers.createFromKeystore(keystore, keystorePassword, password, cb)
  },
  createFromPrivateKey(privateKey: string, password: string, cb: RpcCallback) {
    signers.createFromPrivateKey(privateKey, password, cb)
  },
  addPrivateKey(id: string, privateKey: string, password: string, cb: RpcCallback) {
    signers.addPrivateKey(id, privateKey, password, cb)
  },
  removePrivateKey(id: string, index: number, password: string, cb: RpcCallback) {
    signers.removePrivateKey(id, index, password, cb)
  },
  addKeystore(id: string, keystore: any, keystorePassword: string, password: string, cb: RpcCallback) {
    signers.addKeystore(id, keystore, keystorePassword, password, cb)
  },
  unlockSigner(id: string, password: string, cb: RpcCallback) {
    signers.unlock(id, password, cb)
  },
  lockSigner(id: string, cb: RpcCallback) {
    signers.lock(id, cb)
  },
  remove(id: string) {
    signers.remove(id)
  },
  async resolveEnsName(name: string, cb: RpcCallback) {
    log.debug('Resolving ENS name', { name })

    try {
      const address = await resolveName(name)
      cb(null, address)
    } catch (err) {
      log.warn(`Could not resolve ENS name ${name}:`, err)
      return cb(err)
    }
  },
  verifyAddress(cb: RpcCallback) {
    const res = (err: any, data: any) => cb(err, data || false)
    accounts.verifyAddress(true, res)
  },
  setBaseFee(fee: string, handlerId: string, cb: RpcCallback) {
    callbackWhenDone(() => accounts.setBaseFee(fee, handlerId, true), cb)
  },
  setPriorityFee(fee: string, handlerId: string, cb: RpcCallback) {
    callbackWhenDone(() => accounts.setPriorityFee(fee, handlerId, true), cb)
  },
  setGasPrice(price: string, handlerId: string, cb: RpcCallback) {
    callbackWhenDone(() => accounts.setGasPrice(price, handlerId, true), cb)
  },
  setGasLimit(limit: string, handlerId: string, cb: RpcCallback) {
    callbackWhenDone(() => accounts.setGasLimit(limit, handlerId, true), cb)
  },
  removeFeeUpdateNotice(handlerId: string, cb: RpcCallback) {
    accounts.removeFeeUpdateNotice(handlerId, cb)
  },
  signerCompatibility(handlerId: string, cb: RpcCallback) {
    accounts.signerCompatibility(handlerId, cb)
  },
  openExplorer(chain: any) {
    openBlockExplorer(chain)
  }
}

const unwrap = (v: any) => (v !== undefined || v !== null ? JSON.parse(v) : v)
const wrap = (v: any) => (v !== undefined || v !== null ? JSON.stringify(v) : v)

ipcMain.on('main:rpc', (event, id, method, ...rawArgs) => {
  const parsedId = unwrap(id)
  const parsedMethod = unwrap(method)
  const args = rawArgs.map((arg: any) => unwrap(arg))
  if (rpc[parsedMethod]) {
    rpc[parsedMethod](...args, (...responseArgs: any[]) => {
      event.sender.send(
        'main:rpc',
        parsedId,
        ...responseArgs.map((arg: any) => (arg instanceof Error ? wrap(arg.message) : wrap(arg)))
      )
    })
  } else {
    const errorArgs = [new Error('Unknown RPC method: ' + parsedMethod)]
    event.sender.send(
      'main:rpc',
      parsedId,
      ...errorArgs.map((arg) => (arg instanceof Error ? wrap(arg.message) : wrap(arg)))
    )
  }
})
