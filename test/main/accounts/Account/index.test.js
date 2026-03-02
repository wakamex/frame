import Account from '../../../../main/accounts/Account'
import reveal from '../../../../main/reveal'
import { fetchContract } from '../../../../main/contracts'
import { navClearReq } from '../../../../main/store/actions'

jest.mock('../../../../main/reveal')
jest.mock('../../../../main/contracts', () => {
  const real = jest.requireActual('../../../../main/contracts')

  return {
    ...real,
    fetchContract: jest.fn()
  }
})

jest.mock('../../../../main/provider', () => ({ on: jest.fn() }))
jest.mock('../../../../main/accounts', () => ({ RequestMode: { Normal: 'normal' } }))
jest.mock('../../../../main/signers', () => ({ get: jest.fn() }))
jest.mock('../../../../main/windows', () => ({ showWindow: jest.fn() }))
jest.mock('../../../../main/ens', () => ({
  resolveAddress: jest.fn().mockResolvedValue('frame.eth')
}))

jest.mock('../../../../main/windows/nav', () => ({
  forward: jest.fn()
}))

jest.mock('../../../../main/store')
jest.mock('../../../../main/store/actions', () => ({
  setPermission: jest.fn(),
  navClearReq: jest.fn()
}))
jest.mock('valtio', () => ({
  subscribe: jest.fn(() => jest.fn()),
  snapshot: jest.fn((s) => s),
  proxy: jest.fn((s) => s)
}))

let account

const accounts = { update: jest.fn() }

const accountState = {
  address: '0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990',
  name: 'Test Account'
}

beforeEach(() => {
  account = new Account(accountState, accounts)
  fetchContract.mockResolvedValueOnce(undefined)
})

describe('constructor', () => {
  it('sets address (lowercased) from accountState', () => {
    expect(account.address).toBe(accountState.address.toLowerCase())
  })

  it('sets name from accountState', () => {
    expect(account.name).toBe(accountState.name)
  })
})

describe('#getSelectedAddress', () => {
  it('returns the account address', () => {
    expect(account.getSelectedAddress()).toBe(accountState.address.toLowerCase())
  })
})

describe('#summary', () => {
  it('returns serializable snapshot with id, name, signer, status, requests', () => {
    const s = account.summary()
    expect(s).toHaveProperty('id', accountState.address.toLowerCase())
    expect(s).toHaveProperty('name', accountState.name)
    expect(s).toHaveProperty('signer')
    expect(s).toHaveProperty('status')
    expect(s).toHaveProperty('requests')
  })
})

describe('#addRequest', () => {
  describe('recognizing requests', () => {
    it('recognizes an ERC-20 approval', (done) => {
      const request = {
        handlerId: '123456',
        type: 'transaction',
        data: {
          chainId: '0x539',
          to: '0x6887246668a3b87F54DeB3b94Ba47a6f63F32985',
          data: '0x095ea7b30000000000000000000000009bc5baf874d2da8d216ae9f137804184ee5afef40000000000000000000000000000000000000000000000000000000000011170'
        }
      }

      reveal.recog.mockResolvedValue([
        {
          id: 'erc20:approve'
        }
      ])

      accounts.update.mockImplementationOnce(() => {})
      accounts.update.mockImplementationOnce(() => {
        expect(request.recognizedActions).toHaveLength(1)
        done()
      })

      account.addRequest(request)
    })

    it('adds request to internal map', (done) => {
      const request = {
        handlerId: 'req-add-test',
        type: 'transaction',
        data: {
          chainId: '0x1',
          from: '0x690b9a9e9aa1c9db991c7721a92d351db4fac990',
          to: '0x6887246668a3b87F54DeB3b94Ba47a6f63F32985',
          data: '0x'
        }
      }

      accounts.update.mockImplementationOnce(() => {
        expect(account.requests['req-add-test']).toBeDefined()
        done()
      })

      account.addRequest(request)
    })

    it('calls accounts.update after adding request', (done) => {
      const request = {
        handlerId: 'req-update-test',
        type: 'transaction',
        data: {
          chainId: '0x1',
          from: '0x690b9a9e9aa1c9db991c7721a92d351db4fac990',
          to: '0x6887246668a3b87F54DeB3b94Ba47a6f63F32985',
          data: '0x'
        }
      }

      accounts.update.mockImplementationOnce(() => {
        done()
      })

      account.addRequest(request)
    })

    it('transaction type triggers reveal.recog for action recognition', (done) => {
      const request = {
        handlerId: 'tx-recog-test',
        type: 'transaction',
        data: {
          chainId: '0x539',
          to: '0x6887246668a3b87F54DeB3b94Ba47a6f63F32985',
          data: '0x095ea7b30000000000000000000000009bc5baf874d2da8d216ae9f137804184ee5afef40000000000000000000000000000000000000000000000000000000000011170'
        }
      }

      reveal.recog.mockResolvedValue([{ id: 'erc20:approve' }])

      accounts.update.mockImplementationOnce(() => {})
      accounts.update.mockImplementationOnce(() => {
        expect(reveal.recog).toHaveBeenCalled()
        done()
      })

      account.addRequest(request)
    })

    it('non-transaction type does NOT call reveal.recog', (done) => {
      reveal.recog.mockClear()

      const request = {
        handlerId: 'access-req-test',
        type: 'access',
        data: {},
        origin: 'test-origin',
        account: accountState.address
      }

      accounts.update.mockImplementationOnce(() => {
        expect(reveal.recog).not.toHaveBeenCalled()
        done()
      })

      account.addRequest(request)
    })
  })
})

describe('#clearRequest', () => {
  it('removes request from map', () => {
    const handlerId = 'clear-req-test'
    account.requests[handlerId] = { handlerId }
    account.clearRequest(handlerId)
    expect(account.requests[handlerId]).toBeUndefined()
  })

  it('calls navClearReq with handlerId', () => {
    const handlerId = 'clear-req-nav-test'
    account.requests[handlerId] = { handlerId }
    account.clearRequest(handlerId)
    expect(navClearReq).toHaveBeenCalledWith(handlerId, expect.any(Boolean))
  })
})

describe('#getRequest', () => {
  it('returns specific request by id', () => {
    const handlerId = 'get-req-test'
    const req = { handlerId, type: 'transaction' }
    account.requests[handlerId] = req
    expect(account.getRequest(handlerId)).toBe(req)
  })

  it('returns undefined for non-existent id', () => {
    expect(account.getRequest('nonexistent-id')).toBeUndefined()
  })
})

describe('requests collection', () => {
  it('returns all pending requests via requests property', () => {
    account.requests = {}
    account.requests['req-1'] = { handlerId: 'req-1' }
    account.requests['req-2'] = { handlerId: 'req-2' }
    const requests = Object.values(account.requests)
    expect(requests).toHaveLength(2)
  })

  it('no state leaks between requests after clearRequest', () => {
    const id1 = 'leak-test-1'
    const id2 = 'leak-test-2'
    account.requests[id1] = { handlerId: id1 }
    account.requests[id2] = { handlerId: id2 }

    account.clearRequest(id1)

    expect(account.requests[id1]).toBeUndefined()
    expect(account.requests[id2]).toBeDefined()
  })
})

describe('#rename', () => {
  it('updates account name', () => {
    account.rename('New Name')
    expect(account.name).toBe('New Name')
  })

  it('calls accounts.update with updated name after rename', () => {
    accounts.update.mockClear()
    account.rename('Another Name')
    expect(accounts.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Another Name' })
    )
  })
})

describe('#update', () => {
  it('calls accounts.update with current summary', () => {
    accounts.update.mockClear()
    account.update()
    expect(accounts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: accountState.address.toLowerCase(),
        name: accountState.name
      })
    )
  })
})

describe('#signMessage', () => {
  it('errors if no signer attached', (done) => {
    account.signer = ''
    account.signMessage('hello world', (err) => {
      expect(err).toBeDefined()
      expect(err.message).toBe('No signer found for this account')
      done()
    })
  })

  it('errors if message is empty', (done) => {
    account.signMessage('', (err) => {
      expect(err).toBeDefined()
      done()
    })
  })

  it('delegates to signer.signMessage when signer is present', (done) => {
    const mockSigner = {
      addresses: [accountState.address.toLowerCase()],
      signMessage: jest.fn((index, message, cb) => cb(null, '0xsignature'))
    }

    const signersModule = require('../../../../main/signers')
    signersModule.get.mockReturnValue(mockSigner)

    account.signer = 'test-signer-id'
    account.signMessage('hello world', (err, result) => {
      expect(err).toBeNull()
      expect(result).toBe('0xsignature')
      done()
    })
  })
})

describe('#signTypedData', () => {
  it('errors if no signer attached', (done) => {
    account.signer = ''
    account.signTypedData({ data: { types: {}, domain: {}, primaryType: 'Test', message: {} } }, (err) => {
      expect(err).toBeDefined()
      expect(err.message).toBe('No signer found for this account')
      done()
    })
  })

  it('errors if typed data is missing', (done) => {
    account.signer = ''
    account.signTypedData({ data: null }, (err) => {
      expect(err).toBeDefined()
      done()
    })
  })

  it('delegates to signer.signTypedData when signer is present', (done) => {
    const mockSigner = {
      addresses: [accountState.address.toLowerCase()],
      signTypedData: jest.fn((index, typedMessage, cb) => cb(null, '0xsignature'))
    }

    const signersModule = require('../../../../main/signers')
    signersModule.get.mockReturnValue(mockSigner)

    account.signer = 'test-signer-id'
    account.signTypedData({ data: { types: {}, domain: {}, primaryType: 'Test', message: {} } }, (err, result) => {
      expect(err).toBeNull()
      expect(result).toBe('0xsignature')
      done()
    })
  })
})

describe('#signTransaction', () => {
  const validRawTx = {
    from: '0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990',
    to: '0x6887246668a3b87F54DeB3b94Ba47a6f63F32985',
    value: '0x0',
    data: '0x',
    gas: '0x5208',
    nonce: '0x0'
  }

  it('errors if no signer attached', (done) => {
    account.signer = ''
    account.signTransaction(validRawTx, (err) => {
      expect(err).toBeDefined()
      expect(err.message).toBe('No signer found for this account')
      done()
    })
  })

  it('delegates to signer.signTransaction when signer is present', (done) => {
    const mockSigner = {
      addresses: [accountState.address.toLowerCase()],
      signTransaction: jest.fn((index, rawTx, cb) => cb(null, '0xsignedtx'))
    }

    const signersModule = require('../../../../main/signers')
    signersModule.get.mockReturnValue(mockSigner)

    account.signer = 'test-signer-id'
    account.signTransaction(validRawTx, (err, result) => {
      expect(err).toBeNull()
      expect(result).toBe('0xsignedtx')
      done()
    })
  })
})

describe('#close', () => {
  it('invokes the account state unsubscribe function', () => {
    const mockUnsubscribe = jest.fn()
    const { subscribe } = require('valtio')
    subscribe.mockImplementationOnce(() => mockUnsubscribe)

    const freshAccount = new Account(accountState, accounts)
    freshAccount.close()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
