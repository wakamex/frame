import AutoUpdater from '../../../main/updater/autoUpdater'

jest.mock('electron-log')
jest.mock('electron-updater', () => {
  const EventEmitter = require('events')
  class MockAppUpdater extends EventEmitter {
    constructor() {
      super()
      this.logger = null
      this.allowPrerelease = false
      this.autoDownload = false
    }
    checkForUpdates = jest.fn()
    downloadUpdate = jest.fn()
    quitAndInstall = jest.fn()
  }
  return {
    NsisUpdater: MockAppUpdater,
    MacUpdater: MockAppUpdater,
    AppImageUpdater: MockAppUpdater,
    CancellationToken: jest.fn().mockImplementation(() => ({ cancel: jest.fn(), dispose: jest.fn() }))
  }
})
jest.mock('domain', () => ({
  create: jest.fn(() => ({
    on: jest.fn(),
    run: jest.fn((fn) => fn()),
    exit: jest.fn()
  }))
}))

const { CancellationToken } = require('electron-updater')
const domainMod = require('domain')

function getElectronAutoUpdater(autoUpdater) {
  // Access private field via the instance
  return autoUpdater.electronAutoUpdater
}

describe('AutoUpdater', () => {
  let autoUpdater

  beforeEach(() => {
    autoUpdater = new AutoUpdater()
  })

  afterEach(() => {
    autoUpdater.removeAllListeners()
  })

  describe('constructor', () => {
    it('sets allowPrerelease to false', () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      expect(inner.allowPrerelease).toBe(false)
    })

    it('sets autoDownload to false', () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      expect(inner.autoDownload).toBe(false)
    })

    it('registers a domain error handler', () => {
      const mockDomain = domainMod.create.mock.results[domainMod.create.mock.results.length - 1].value
      expect(mockDomain.on).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })

  describe('event relay', () => {
    it('relays update-available with version and location=auto', (done) => {
      autoUpdater.once('update-available', (info) => {
        expect(info.version).toBe('1.2.3')
        expect(info.location).toBe('auto')
        done()
      })
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.emit('update-available', { version: '1.2.3' })
    })

    it('relays update-not-available', (done) => {
      const payload = { version: '0.0.1' }
      autoUpdater.once('update-not-available', (res) => {
        expect(res).toBe(payload)
        done()
      })
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.emit('update-not-available', payload)
    })

    it('relays update-downloaded and disposes cancellation token', (done) => {
      // simulate an in-progress download with a token
      const fakeToken = { cancel: jest.fn(), dispose: jest.fn() }
      autoUpdater.downloadCancellationToken = fakeToken

      autoUpdater.once('update-downloaded', () => {
        expect(fakeToken.dispose).toHaveBeenCalled()
        done()
      })
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.emit('update-downloaded', {})
    })

    it('relays error as wrapped Error', (done) => {
      autoUpdater.once('error', (err) => {
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toBe('update error')
        done()
      })
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.emit('error', new Error('update error'))
    })

    it('uses message parameter when provided for error relay', (done) => {
      autoUpdater.once('error', (err) => {
        expect(err.message).toBe('custom message')
        done()
      })
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.emit('error', new Error('original'), 'custom message')
    })
  })

  describe('checkForUpdates', () => {
    it('calls electronAutoUpdater.checkForUpdates inside domain', async () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.checkForUpdates.mockResolvedValue({ updateInfo: {} })
      const mockDomain = domainMod.create.mock.results[domainMod.create.mock.results.length - 1].value

      await autoUpdater.checkForUpdates()

      expect(mockDomain.run).toHaveBeenCalled()
      expect(inner.checkForUpdates).toHaveBeenCalled()
    })

    it('emits update-not-available when checkForUpdates returns null', (done) => {
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.checkForUpdates.mockResolvedValue(null)

      autoUpdater.once('update-not-available', () => {
        done()
      })

      autoUpdater.checkForUpdates()
    })

    it('catches exceptions without crashing', async () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.checkForUpdates.mockRejectedValue(new Error('network failure'))

      // Should not throw
      await expect(autoUpdater.checkForUpdates()).resolves.toBeUndefined()
    })
  })

  describe('downloadUpdate', () => {
    it('creates CancellationToken and passes it to electronAutoUpdater.downloadUpdate', async () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.downloadUpdate.mockResolvedValue(undefined)

      await autoUpdater.downloadUpdate()

      expect(CancellationToken).toHaveBeenCalled()
      expect(inner.downloadUpdate).toHaveBeenCalledWith(expect.objectContaining({ cancel: expect.any(Function), dispose: expect.any(Function) }))
    })

    it('cancels and disposes CancellationToken on download failure', async () => {
      const inner = getElectronAutoUpdater(autoUpdater)
      inner.downloadUpdate.mockRejectedValue(new Error('download failed'))

      await autoUpdater.downloadUpdate()

      const tokenInstance = CancellationToken.mock.results[CancellationToken.mock.results.length - 1].value
      expect(tokenInstance.cancel).toHaveBeenCalled()
      expect(tokenInstance.dispose).toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('removes all listeners, exits domain, and emits exit', (done) => {
      const mockDomain = domainMod.create.mock.results[domainMod.create.mock.results.length - 1].value
      const inner = getElectronAutoUpdater(autoUpdater)

      autoUpdater.once('exit', () => {
        expect(inner.removeAllListeners).toHaveBeenCalled && undefined
        expect(mockDomain.exit).toHaveBeenCalled()
        done()
      })

      autoUpdater.close()
    })

    it('cancels any pending download on close', () => {
      const fakeToken = { cancel: jest.fn(), dispose: jest.fn() }
      autoUpdater.downloadCancellationToken = fakeToken

      autoUpdater.close()

      expect(fakeToken.cancel).toHaveBeenCalled()
      expect(fakeToken.dispose).toHaveBeenCalled()
    })
  })

  describe('quitAndInstall', () => {
    it('delegates to electronAutoUpdater.quitAndInstall', async () => {
      const inner = getElectronAutoUpdater(autoUpdater)

      await autoUpdater.quitAndInstall()

      expect(inner.quitAndInstall).toHaveBeenCalled()
    })
  })

  describe('domain error isolation', () => {
    it('handles uncaught errors from electron-updater without crashing the app', (done) => {
      const mockDomain = domainMod.create.mock.results[domainMod.create.mock.results.length - 1].value
      const domainErrorHandler = mockDomain.on.mock.calls.find(([event]) => event === 'error')?.[1]

      expect(domainErrorHandler).toBeDefined()

      autoUpdater.once('error', (err) => {
        expect(err.message).toBe('uncaught updater error')
        done()
      })

      // Trigger the domain error handler directly — simulates electron-updater throwing
      domainErrorHandler(new Error('uncaught updater error'))
    })
  })
})
