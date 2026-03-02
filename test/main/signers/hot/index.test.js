import * as bip39 from 'bip39'
import zxcvbn from 'zxcvbn'
import fs from 'fs'

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/test-signers') } }))
jest.mock('electron-log')
jest.mock('bip39', () => ({ generateMnemonic: jest.fn(() => 'test mnemonic phrase') }))
jest.mock('zxcvbn', () => jest.fn(() => ({ score: 4 })))
jest.mock('fs')
jest.mock('fs-extra', () => ({ ensureDirSync: jest.fn() }))
jest.mock('../../../../main/signers/hot/SeedSigner', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addSeed: jest.fn(),
    addPhrase: jest.fn(),
    close: jest.fn()
  }))
}))

jest.mock('../../../../main/signers/hot/RingSigner', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addPrivateKey: jest.fn(),
    addKeystore: jest.fn(),
    close: jest.fn()
  }))
}))
jest.mock('../../../../main/crypt', () => ({
  __esModule: true,
  default: { stringToKey: jest.fn(() => Buffer.from('test-id')) }
}))

let hot
let MockSeedSigner
let MockRingSigner
let crypt

beforeAll(async () => {
  hot = (await import('../../../../main/signers/hot')).default
  MockSeedSigner = (await import('../../../../main/signers/hot/SeedSigner')).default
  MockRingSigner = (await import('../../../../main/signers/hot/RingSigner')).default
  crypt = (await import('../../../../main/crypt')).default
})

const VALID_PASSWORD = 'ValidP@ssw0rd!long'

describe('newPhrase', () => {
  it('calls bip39.generateMnemonic and returns via callback', () => {
    const cb = jest.fn()
    hot.newPhrase(cb)
    expect(bip39.generateMnemonic).toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(null, 'test mnemonic phrase')
  })
})

describe('createFromSeed', () => {
  let mockSigners

  beforeEach(() => {
    mockSigners = { add: jest.fn(), exists: jest.fn() }
  })

  it('returns error if seed is missing', () => {
    const cb = jest.fn()
    hot.createFromSeed(mockSigners, '', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/seed required/i)
  })

  it('returns error if password is missing', () => {
    const cb = jest.fn()
    hot.createFromSeed(mockSigners, 'some seed', '', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/password required/i)
  })

  it('returns error if password is too short', () => {
    const cb = jest.fn()
    hot.createFromSeed(mockSigners, 'some seed', 'short', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too short/i)
  })

  it('returns error if password is too weak (zxcvbn score < 3)', () => {
    zxcvbn.mockReturnValueOnce({ score: 2 })
    const cb = jest.fn()
    hot.createFromSeed(mockSigners, 'some seed', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too weak/i)
  })

  it('creates SeedSigner, calls addSeed, adds to signers on success', () => {
    const mockSigner = {
      addSeed: jest.fn((seed, pw, cb) => cb(null, {})),
      close: jest.fn()
    }
    MockSeedSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromSeed(mockSigners, 'some seed', VALID_PASSWORD, cb)

    expect(MockSeedSigner).toHaveBeenCalled()
    expect(mockSigner.addSeed).toHaveBeenCalledWith('some seed', VALID_PASSWORD, expect.any(Function))
    expect(mockSigners.add).toHaveBeenCalledWith(mockSigner)
    expect(cb).toHaveBeenCalledWith(null, mockSigner)
  })

  it('closes signer and returns error if addSeed fails', () => {
    const addSeedError = new Error('addSeed failed')
    const mockSigner = {
      addSeed: jest.fn((seed, pw, cb) => cb(addSeedError)),
      close: jest.fn()
    }
    MockSeedSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromSeed(mockSigners, 'some seed', VALID_PASSWORD, cb)

    expect(mockSigner.close).toHaveBeenCalled()
    expect(mockSigners.add).not.toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(addSeedError)
  })
})

describe('createFromPhrase', () => {
  let mockSigners

  beforeEach(() => {
    mockSigners = { add: jest.fn(), exists: jest.fn() }
  })

  it('returns error if phrase is missing', () => {
    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, '', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/phrase required/i)
  })

  it('returns error if password is missing', () => {
    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, 'some phrase', '', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/password required/i)
  })

  it('returns error if password is too short', () => {
    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, 'some phrase', 'short', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too short/i)
  })

  it('returns error if password is too weak (zxcvbn score < 3)', () => {
    zxcvbn.mockReturnValueOnce({ score: 2 })
    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, 'some phrase', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too weak/i)
  })

  it('creates SeedSigner, calls addPhrase, adds to signers on success', () => {
    const mockSigner = {
      addPhrase: jest.fn((phrase, pw, cb) => cb(null)),
      close: jest.fn()
    }
    MockSeedSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, 'some phrase', VALID_PASSWORD, cb)

    expect(MockSeedSigner).toHaveBeenCalled()
    expect(mockSigner.addPhrase).toHaveBeenCalledWith('some phrase', VALID_PASSWORD, expect.any(Function))
    expect(mockSigners.add).toHaveBeenCalledWith(mockSigner)
    expect(cb).toHaveBeenCalledWith(null, mockSigner)
  })

  it('closes signer and returns error if addPhrase fails', () => {
    const err = new Error('addPhrase failed')
    const mockSigner = {
      addPhrase: jest.fn((phrase, pw, cb) => cb(err)),
      close: jest.fn()
    }
    MockSeedSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromPhrase(mockSigners, 'some phrase', VALID_PASSWORD, cb)

    expect(mockSigner.close).toHaveBeenCalled()
    expect(mockSigners.add).not.toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(err)
  })
})

describe('createFromPrivateKey', () => {
  let mockSigners

  beforeEach(() => {
    mockSigners = { add: jest.fn(), exists: jest.fn() }
  })

  it('strips hex prefix from private key before passing to addPrivateKey', () => {
    const mockSigner = {
      addPrivateKey: jest.fn((key, pw, cb) => cb(null)),
      close: jest.fn()
    }
    MockRingSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, '0xabc123', VALID_PASSWORD, cb)

    expect(mockSigner.addPrivateKey).toHaveBeenCalledWith('abc123', VALID_PASSWORD, expect.any(Function))
  })

  it('returns error if private key is empty after stripping hex prefix', () => {
    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, '', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/private key required/i)
  })

  it('returns error if password is missing', () => {
    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, 'abc123', '', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/password required/i)
  })

  it('returns error if password is too short', () => {
    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, 'abc123', 'short', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too short/i)
  })

  it('returns error if password is too weak (zxcvbn score < 3)', () => {
    zxcvbn.mockReturnValueOnce({ score: 2 })
    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, 'abc123', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too weak/i)
  })

  it('creates RingSigner, calls addPrivateKey, adds to signers on success', () => {
    const mockSigner = {
      addPrivateKey: jest.fn((key, pw, cb) => cb(null)),
      close: jest.fn()
    }
    MockRingSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, 'abc123', VALID_PASSWORD, cb)

    expect(MockRingSigner).toHaveBeenCalled()
    expect(mockSigner.addPrivateKey).toHaveBeenCalledWith('abc123', VALID_PASSWORD, expect.any(Function))
    expect(mockSigners.add).toHaveBeenCalledWith(mockSigner)
    expect(cb).toHaveBeenCalledWith(null, mockSigner)
  })

  it('closes signer and returns error if addPrivateKey fails', () => {
    const err = new Error('addPrivateKey failed')
    const mockSigner = {
      addPrivateKey: jest.fn((key, pw, cb) => cb(err)),
      close: jest.fn()
    }
    MockRingSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromPrivateKey(mockSigners, 'abc123', VALID_PASSWORD, cb)

    expect(mockSigner.close).toHaveBeenCalled()
    expect(mockSigners.add).not.toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(err)
  })
})

describe('createFromKeystore', () => {
  let mockSigners

  beforeEach(() => {
    mockSigners = { add: jest.fn(), exists: jest.fn() }
  })

  it('returns error if keystore is missing', () => {
    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, null, 'keystorePw', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/keystore required/i)
  })

  it('returns error if keystorePassword is missing', () => {
    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, { version: 3 }, '', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/keystore password required/i)
  })

  it('returns error if password is missing', () => {
    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, { version: 3 }, 'keystorePw', '', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/password required/i)
  })

  it('returns error if password is too short', () => {
    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, { version: 3 }, 'keystorePw', 'short', cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too short/i)
  })

  it('returns error if password is too weak (zxcvbn score < 3)', () => {
    zxcvbn.mockReturnValueOnce({ score: 2 })
    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, { version: 3 }, 'keystorePw', VALID_PASSWORD, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(Error))
    expect(cb.mock.calls[0][0].message).toMatch(/too weak/i)
  })

  it('creates RingSigner, calls addKeystore, adds to signers on success', () => {
    const mockSigner = {
      addKeystore: jest.fn((ks, ksPw, pw, cb) => cb(null)),
      close: jest.fn()
    }
    MockRingSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    const keystore = { version: 3 }
    hot.createFromKeystore(mockSigners, keystore, 'keystorePw', VALID_PASSWORD, cb)

    expect(MockRingSigner).toHaveBeenCalled()
    expect(mockSigner.addKeystore).toHaveBeenCalledWith(keystore, 'keystorePw', VALID_PASSWORD, expect.any(Function))
    expect(mockSigners.add).toHaveBeenCalledWith(mockSigner)
    expect(cb).toHaveBeenCalledWith(null, mockSigner)
  })

  it('closes signer and returns error if addKeystore fails', () => {
    const err = new Error('addKeystore failed')
    const mockSigner = {
      addKeystore: jest.fn((ks, ksPw, pw, cb) => cb(err)),
      close: jest.fn()
    }
    MockRingSigner.mockImplementationOnce(() => mockSigner)

    const cb = jest.fn()
    hot.createFromKeystore(mockSigners, { version: 3 }, 'keystorePw', VALID_PASSWORD, cb)

    expect(mockSigner.close).toHaveBeenCalled()
    expect(mockSigners.add).not.toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith(err)
  })
})

describe('scan', () => {
  let mockSigners

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
    mockSigners = { add: jest.fn(), exists: jest.fn(() => false) }
    jest.spyOn(fs, 'readdirSync').mockReturnValue([])
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{}')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('schedules a delayed scan with setTimeout(scan, 4000)', () => {
    hot.scan(mockSigners)
    expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1)
  })

  it('reads signer files from the SIGNERS_PATH directory', async () => {
    fs.readdirSync.mockReturnValue([])

    const scan = hot.scan(mockSigners)
    await scan()

    expect(fs.readdirSync).toHaveBeenCalledWith(expect.stringContaining('signers'))
  })

  it('creates SeedSigner for type=seed signers', async () => {
    const signerData = { id: 'stored-id', addresses: ['0x123'], type: 'seed', encryptedSeed: 'enc', network: 'mainnet' }
    fs.readdirSync.mockReturnValue(['seed.json'])
    fs.readFileSync.mockReturnValue(JSON.stringify(signerData))

    const mockSeedInstance = {}
    MockSeedSigner.mockImplementationOnce(() => mockSeedInstance)

    const scan = hot.scan(mockSigners)
    const p = scan()
    await jest.advanceTimersByTimeAsync(100)
    await p

    expect(MockSeedSigner).toHaveBeenCalledWith(
      expect.objectContaining({ addresses: ['0x123'], encryptedSeed: 'enc', network: 'mainnet' })
    )
    expect(mockSigners.add).toHaveBeenCalledWith(mockSeedInstance)
  })

  it('creates RingSigner for type=ring signers', async () => {
    const signerData = { id: 'stored-id', addresses: ['0x456'], type: 'ring', encryptedKeys: 'keys', network: 'mainnet' }
    fs.readdirSync.mockReturnValue(['ring.json'])
    fs.readFileSync.mockReturnValue(JSON.stringify(signerData))

    const mockRingInstance = {}
    MockRingSigner.mockImplementationOnce(() => mockRingInstance)

    const scan = hot.scan(mockSigners)
    const p = scan()
    await jest.advanceTimersByTimeAsync(100)
    await p

    expect(MockRingSigner).toHaveBeenCalledWith(
      expect.objectContaining({ addresses: ['0x456'], encryptedKeys: 'keys', network: 'mainnet' })
    )
    expect(mockSigners.add).toHaveBeenCalledWith(mockRingInstance)
  })

  it('skips signers that already exist (signers.exists check)', async () => {
    const signerData = { id: 'stored-id', addresses: ['0x123'], type: 'seed' }
    fs.readdirSync.mockReturnValue(['seed.json'])
    fs.readFileSync.mockReturnValue(JSON.stringify(signerData))
    mockSigners.exists.mockReturnValue(true)

    const scan = hot.scan(mockSigners)
    const p = scan()
    await jest.advanceTimersByTimeAsync(100)
    await p

    expect(mockSigners.add).not.toHaveBeenCalled()
  })

  it('handles corrupt signer file gracefully (logs error, continues)', async () => {
    fs.readdirSync.mockReturnValue(['corrupt.json'])
    fs.readFileSync.mockReturnValue('invalid { json {{{')

    const scan = hot.scan(mockSigners)
    await expect(scan()).resolves.not.toThrow()

    expect(mockSigners.add).not.toHaveBeenCalled()
  })

  it('skips signers with empty addresses array', async () => {
    const signerData = { id: 'stored-id', addresses: [], type: 'seed' }
    fs.readdirSync.mockReturnValue(['seed.json'])
    fs.readFileSync.mockReturnValue(JSON.stringify(signerData))

    const scan = hot.scan(mockSigners)
    const p = scan()
    await jest.advanceTimersByTimeAsync(100)
    await p

    expect(mockSigners.add).not.toHaveBeenCalled()
  })

  it('uses crypt.stringToKey to derive id from addresses', async () => {
    const signerData = { id: 'stored-id', addresses: ['0x123', '0x456'], type: 'seed' }
    fs.readdirSync.mockReturnValue(['seed.json'])
    fs.readFileSync.mockReturnValue(JSON.stringify(signerData))

    const scan = hot.scan(mockSigners)
    const p = scan()
    await jest.advanceTimersByTimeAsync(100)
    await p

    expect(crypt.stringToKey).toHaveBeenCalledWith('0x123,0x456')
  })
})
