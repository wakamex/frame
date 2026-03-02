import log from 'electron-log'

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj),
  unstable_enableOp: jest.fn()
}))

// Capture the ipcMain handler so we can invoke it directly
let rpcHandler = null

jest.mock('electron', () => ({
  ipcMain: {
    on: jest.fn((channel, handler) => {
      if (channel === 'main:rpc') {
        rpcHandler = handler
      }
    }),
    removeAllListeners: jest.fn()
  }
}))

jest.mock('../../../main/store')
jest.mock('../../../main/store/persist')

jest.mock('../../../main/store/actions', () => ({
  updateLattice: jest.fn(),
  trustExtension: jest.fn(),
  addTxRecord: jest.fn()
}))

const mockAccounts = {
  signTransaction: jest.fn(),
  signMessage: jest.fn(),
  getAccounts: jest.fn(),
  getCoinbase: jest.fn(),
  setSigner: jest.fn(),
  unsetSigner: jest.fn(),
  getSelectedAddresses: jest.fn(() => []),
  add: jest.fn(),
  remove: jest.fn(),
  setRequestPending: jest.fn(),
  setRequestError: jest.fn(),
  setRequestSuccess: jest.fn(),
  setTxSent: jest.fn(),
  declineRequest: jest.fn(),
  updateRequest: jest.fn(),
  confirmRequestApproval: jest.fn(),
  verifyAddress: jest.fn(),
  setBaseFee: jest.fn(),
  setPriorityFee: jest.fn(),
  setGasPrice: jest.fn(),
  setGasLimit: jest.fn(),
  removeFeeUpdateNotice: jest.fn(),
  signerCompatibility: jest.fn()
}

jest.mock('../../../main/accounts', () => mockAccounts)

jest.mock('../../../main/signers', () => ({
  get: jest.fn(),
  unlock: jest.fn(),
  lock: jest.fn(),
  remove: jest.fn(),
  createFromPhrase: jest.fn(),
  createFromKeystore: jest.fn(),
  createFromPrivateKey: jest.fn(),
  addPrivateKey: jest.fn(),
  removePrivateKey: jest.fn(),
  addKeystore: jest.fn()
}))

const mockProvider = {
  send: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  accountsChanged: jest.fn(),
  connection: {},
  approveTransactionRequest: jest.fn(),
  approveSign: jest.fn(),
  approveSignTypedData: jest.fn(),
  declineRequest: jest.fn()
}

jest.mock('../../../main/provider', () => mockProvider)

jest.mock('../../../main/ens', () => ({
  resolveName: jest.fn()
}))

jest.mock('../../../main/windows/window', () => ({
  openBlockExplorer: jest.fn()
}))

jest.mock('../../../main/windows/dialog', () => ({
  openFileDialog: jest.fn()
}))

jest.mock('../../../main/launch', () => ({
  status: jest.fn()
}))

jest.mock('../../../main/txHistory', () => ({
  track: jest.fn()
}))

jest.mock('../../../resources/utils', () => ({
  arraysEqual: jest.fn(() => true),
  randomLetters: jest.fn(() => 'abcdef')
}))

jest.mock('../../../main/signatures', () => ({
  isSignatureRequest: jest.fn((req) => req.type === 'sign' || req.type === 'signTypedData')
}))

jest.mock('../../../main/signers/trezor/bridge', () => ({
  default: {
    pinEntered: jest.fn(),
    passphraseEntered: jest.fn(),
    enterPassphraseOnDevice: jest.fn()
  }
}))

jest.mock('viem', () => ({
  isAddress: jest.fn()
}))

// Import modules after mocks are set up
import { resolveName } from '../../../main/ens'
import { openBlockExplorer } from '../../../main/windows/window'
import { isAddress } from 'viem'
import { snapshot } from 'valtio'

// JSON serialization helpers matching what the RPC handler uses:
// wrap: value -> JSON string (used for sending)
// unwrap: JSON string -> value (used for receiving)
const wrap = (v) => JSON.stringify(v)
const jsonParse = (v) => {
  if (v === undefined || v === null) return v
  return JSON.parse(v)
}

function createMockEvent() {
  const sent = []
  const event = {
    sender: {
      send: jest.fn((...args) => sent.push(args))
    },
    _sent: sent
  }
  return event
}

// Flush the microtask queue to allow async operations to complete
async function flushPromises() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

// Simulate an IPC call and return the event so we can inspect sent messages
async function callRpc(method, ...args) {
  const event = createMockEvent()
  const id = 'test-id-1'
  rpcHandler(event, wrap(id), wrap(method), ...args.map(wrap))
  await flushPromises()
  return event
}

beforeAll(() => {
  log.transports.console.level = false
  // Import the RPC module to register the ipcMain handler
  require('../../../main/rpc/index')
})

afterAll(() => {
  log.transports.console.level = 'debug'
})

describe('main:rpc IPC handler', () => {
  describe('unknown method', () => {
    it('returns an error for unknown RPC methods', async () => {
      const event = await callRpc('nonExistentMethod')
      expect(event._sent).toHaveLength(1)
      // sent[0] = ['main:rpc', parsedId, wrappedError]
      // Note: parsedId is already unwrapped by the handler (not JSON)
      const [channel, id, errorArg] = event._sent[0]
      expect(channel).toBe('main:rpc')
      expect(id).toBe('test-id-1')
      expect(jsonParse(errorArg)).toMatch(/Unknown RPC method/)
    })
  })

  describe('resolveEnsName', () => {
    it('returns address on happy path', async () => {
      const address = '0x22dd63c3619818fdbc262c78baee43cb61e9cccf'
      resolveName.mockResolvedValue(address)

      const event = await callRpc('resolveEnsName', 'vitalik.eth')

      expect(resolveName).toHaveBeenCalledWith('vitalik.eth')
      expect(event._sent).toHaveLength(1)
      // cb(null, address) -> ['main:rpc', id, wrap(null), wrap(address)]
      const [, , errArg, resultArg] = event._sent[0]
      expect(jsonParse(errArg)).toBeNull()
      expect(jsonParse(resultArg)).toBe(address)
    })

    it('wraps ENS errors as string in callback', async () => {
      resolveName.mockRejectedValue(new Error('ENS resolution failed'))

      const event = await callRpc('resolveEnsName', 'bad.eth')

      expect(event._sent).toHaveLength(1)
      // cb(err) where err is Error instance -> wrap(err.message)
      const [, , errArg] = event._sent[0]
      expect(jsonParse(errArg)).toBe('ENS resolution failed')
    })
  })

  describe('createFromAddress', () => {
    it('calls accounts.add when address is valid', async () => {
      isAddress.mockReturnValue(true)

      const event = await callRpc('createFromAddress', '0xvalidaddress', 'My Account')

      expect(mockAccounts.add).toHaveBeenCalledWith('0xvalidaddress', 'My Account', { type: 'Address' })
      // cb() called with no args -> event.sender.send('main:rpc', id) with no extra args
      expect(event._sent).toHaveLength(1)
      expect(event._sent[0]).toHaveLength(2) // only channel + id, no error/result args
    })

    it('returns error when address is invalid', async () => {
      isAddress.mockReturnValue(false)

      const event = await callRpc('createFromAddress', 'notanaddress', 'My Account')

      expect(mockAccounts.add).not.toHaveBeenCalled()
      expect(event._sent).toHaveLength(1)
      const [, , errArg] = event._sent[0]
      expect(jsonParse(errArg)).toBe('Invalid Address')
    })
  })

  describe('approveRequest', () => {
    it('transaction path: sets pending, calls approveTransactionRequest, then setTxSent after timeout', async () => {
      const txHash = '0xtxhash123'
      mockProvider.approveTransactionRequest.mockImplementation((_req, cb) => cb(null, txHash))

      const req = {
        handlerId: 'handler-1',
        type: 'transaction',
        data: {
          chainId: '0x1',
          from: '0x22dd63c3619818fdbc262c78baee43cb61e9cccf',
          to: '0xrecipient',
          value: '0x1',
          data: '0x'
        }
      }

      await callRpc('approveRequest', req)

      expect(mockAccounts.setRequestPending).toHaveBeenCalledWith(req)
      expect(mockProvider.approveTransactionRequest).toHaveBeenCalledWith(req, expect.any(Function))

      // setTxSent is called via setTimeout(1800ms) — advance fake timers
      jest.advanceTimersByTime(2000)
      expect(mockAccounts.setTxSent).toHaveBeenCalledWith('handler-1', txHash)
    })

    it('transaction path: calls setRequestError on failure', async () => {
      const err = new Error('Transaction failed')
      mockProvider.approveTransactionRequest.mockImplementation((_req, cb) => cb(err))

      const req = {
        handlerId: 'handler-2',
        type: 'transaction',
        data: { chainId: '0x1', from: '0xabc' }
      }

      await callRpc('approveRequest', req)

      expect(mockAccounts.setRequestError).toHaveBeenCalledWith('handler-2', err)
      jest.advanceTimersByTime(2000)
      expect(mockAccounts.setTxSent).not.toHaveBeenCalled()
    })

    it('sign path: delegates to provider.approveSign and calls setRequestSuccess', async () => {
      mockProvider.approveSign.mockImplementation((_req, cb) => cb(null, '0xsignature'))

      const req = {
        handlerId: 'handler-3',
        type: 'sign',
        data: {}
      }

      await callRpc('approveRequest', req)

      expect(mockAccounts.setRequestPending).toHaveBeenCalledWith(req)
      expect(mockProvider.approveSign).toHaveBeenCalledWith(req, expect.any(Function))
      expect(mockAccounts.setRequestSuccess).toHaveBeenCalledWith('handler-3')
    })

    it('signTypedData path: delegates to provider.approveSignTypedData and calls setRequestSuccess', async () => {
      mockProvider.approveSignTypedData.mockImplementation((_req, cb) => cb(null, '0xsignature'))

      const req = {
        handlerId: 'handler-4',
        type: 'signTypedData',
        data: {}
      }

      await callRpc('approveRequest', req)

      expect(mockAccounts.setRequestPending).toHaveBeenCalledWith(req)
      expect(mockProvider.approveSignTypedData).toHaveBeenCalledWith(req, expect.any(Function))
      expect(mockAccounts.setRequestSuccess).toHaveBeenCalledWith('handler-4')
    })
  })

  describe('declineRequest', () => {
    it('removes transaction request from accounts and provider', async () => {
      const { isSignatureRequest } = require('../../../main/signatures')
      isSignatureRequest.mockReturnValue(false)

      const req = { handlerId: 'decline-1', type: 'transaction' }
      await callRpc('declineRequest', req)

      expect(mockAccounts.declineRequest).toHaveBeenCalledWith('decline-1')
      expect(mockProvider.declineRequest).toHaveBeenCalledWith(req)
    })

    it('removes signature requests', async () => {
      const { isSignatureRequest } = require('../../../main/signatures')
      isSignatureRequest.mockReturnValue(true)

      const req = { handlerId: 'decline-2', type: 'sign' }
      await callRpc('declineRequest', req)

      expect(mockAccounts.declineRequest).toHaveBeenCalledWith('decline-2')
      expect(mockProvider.declineRequest).toHaveBeenCalledWith(req)
    })
  })

  describe('getState', () => {
    it('returns valtio snapshot of state', async () => {
      const mockStateData = { main: { accounts: {} } }
      snapshot.mockReturnValue(mockStateData)

      const event = await callRpc('getState')

      expect(snapshot).toHaveBeenCalled()
      expect(event._sent).toHaveLength(1)
      // cb(null, snapshot(state)) -> ['main:rpc', id, wrap(null), wrap(mockStateData)]
      const [, , errArg, resultArg] = event._sent[0]
      expect(jsonParse(errArg)).toBeNull()
      expect(jsonParse(resultArg)).toEqual(mockStateData)
    })
  })

  describe('openExplorer', () => {
    it('calls openBlockExplorer with the chain', async () => {
      const chain = { type: 'ethereum', id: 1 }
      await callRpc('openExplorer', chain)
      expect(openBlockExplorer).toHaveBeenCalledWith(chain)
    })
  })

  describe('error wrapping', () => {
    it('converts Error instances to message strings in response', async () => {
      isAddress.mockReturnValue(false)

      const event = await callRpc('createFromAddress', 'invalid', 'Test')

      expect(event._sent).toHaveLength(1)
      const [, , errArg] = event._sent[0]
      // Error is serialized as string message (not an Error object)
      const parsed = jsonParse(errArg)
      expect(typeof parsed).toBe('string')
      expect(parsed).toBe('Invalid Address')
    })
  })

  describe('signTransaction / signMessage delegation', () => {
    it('delegates signTransaction to accounts.signTransaction', async () => {
      mockAccounts.signTransaction.mockImplementation((...args) => {
        const cb = args[args.length - 1]
        if (typeof cb === 'function') cb(null, '0xsignedtx')
      })

      await callRpc('signTransaction', { from: '0xabc', data: '0x' }, 'password')

      expect(mockAccounts.signTransaction).toHaveBeenCalled()
    })

    it('delegates signMessage to accounts.signMessage', async () => {
      mockAccounts.signMessage.mockImplementation((...args) => {
        const cb = args[args.length - 1]
        if (typeof cb === 'function') cb(null, '0xsignedmsg')
      })

      await callRpc('signMessage', '0xaddress', 'hello')

      expect(mockAccounts.signMessage).toHaveBeenCalled()
    })
  })
})
