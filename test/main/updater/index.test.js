jest.mock('electron-log', () => ({
  verbose: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}))

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../main/store', () => ({
  main: { updater: { dontRemind: [] } }
}))

jest.mock('../../../main/store/actions', () => ({
  updateBadge: jest.fn()
}))

jest.mock('../../../main/windows/window', () => ({
  openExternal: jest.fn()
}))

jest.mock('../../../main/updater/manualCheck', () => jest.fn())

jest.mock('../../../main/updater/autoUpdater', () => {
  const { EventEmitter } = require('events')

  class MockAutoUpdater extends EventEmitter {
    constructor() {
      super()
      this.checkForUpdates = jest.fn()
      this.downloadUpdate = jest.fn()
      this.quitAndInstall = jest.fn()
      this.close = jest.fn()
    }
  }

  return { __esModule: true, default: MockAutoUpdater }
})

const UPDATE_INTERVAL = 60 * 60_000

let updater
let mockManualCheck
let mockUpdateBadge
let mockOpenExternal
let mockStore
let mockLog

beforeEach(() => {
  jest.isolateModules(() => {
    updater = require('../../../main/updater/index').default
    mockManualCheck = require('../../../main/updater/manualCheck')
    mockUpdateBadge = require('../../../main/store/actions').updateBadge
    mockOpenExternal = require('../../../main/windows/window').openExternal
    mockStore = require('../../../main/store')
    mockLog = require('electron-log')
  })
  mockStore.main.updater.dontRemind = []
})

afterEach(() => {
  updater.stop()
})

// ─── start() / stop() ────────────────────────────────────────────────────────

describe('start()', () => {
  it('sets up delayed initial check (10s) then periodic interval', () => {
    // spy on whichever check method the current platform uses
    const checkSpy =
      jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {}) ||
      jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)

    // on Linux useAutoUpdater is false, so manual check is used
    const manualSpy = jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)
    const autoSpy = jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {})

    updater.start()

    // No immediate check
    expect(manualSpy).not.toHaveBeenCalled()
    expect(autoSpy).not.toHaveBeenCalled()

    // After 10s, exactly one check happens
    jest.advanceTimersByTime(10_000)
    const totalCalls = manualSpy.mock.calls.length + autoSpy.mock.calls.length
    expect(totalCalls).toBe(1)

    // After another UPDATE_INTERVAL, check fires again
    jest.advanceTimersByTime(UPDATE_INTERVAL)
    const totalCalls2 = manualSpy.mock.calls.length + autoSpy.mock.calls.length
    expect(totalCalls2).toBe(2)
  })

  it('stops existing timers before starting new ones', () => {
    const manualSpy = jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)
    const autoSpy = jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {})

    updater.start()
    updater.start() // second start clears first

    jest.advanceTimersByTime(10_000)

    // only one check should fire
    const totalCalls = manualSpy.mock.calls.length + autoSpy.mock.calls.length
    expect(totalCalls).toBe(1)
  })
})

describe('stop()', () => {
  it('clears all timers', () => {
    const manualSpy = jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)
    const autoSpy = jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {})

    updater.start()
    updater.stop()

    jest.advanceTimersByTime(10_000 + UPDATE_INTERVAL)

    expect(manualSpy).not.toHaveBeenCalled()
    expect(autoSpy).not.toHaveBeenCalled()
  })

  it('closes autoUpdater if running', () => {
    // Trigger checkForAutoUpdate to create autoUpdater instance
    updater.checkForAutoUpdate()
    const instance = updater.autoUpdater
    expect(instance).toBeDefined()

    updater.stop()

    expect(instance.close).toHaveBeenCalled()
    expect(updater.autoUpdater).toBeUndefined()
  })
})

describe('start() after stop()', () => {
  it('restarts cleanly', () => {
    const manualSpy = jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)
    const autoSpy = jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {})

    updater.start()
    updater.stop()
    updater.start()

    jest.advanceTimersByTime(10_000)

    const totalCalls = manualSpy.mock.calls.length + autoSpy.mock.calls.length
    expect(totalCalls).toBe(1)
  })
})

// ─── fetchUpdate() ─────────────────────────────────────────────────────────────

describe('fetchUpdate()', () => {
  it('calls autoUpdater.downloadUpdate when location is auto', () => {
    // Set up internal state: availableUpdate = 'auto', autoUpdater exists
    updater.checkForAutoUpdate()
    const instance = updater.autoUpdater

    updater.availableUpdate = 'auto'
    updater.availableVersion = '2.0.0'

    updater.fetchUpdate()

    expect(instance.downloadUpdate).toHaveBeenCalled()
  })

  it('calls openExternal when location is an https URL', () => {
    const url = 'https://github.com/floating/frame/releases/tag/v2.0.0'
    updater.availableUpdate = url
    updater.availableVersion = '2.0.0'

    updater.fetchUpdate()

    expect(mockOpenExternal).toHaveBeenCalledWith(url)
  })

  it('logs a warning and does not crash when location is auto but no autoUpdater', () => {
    updater.availableUpdate = 'auto'
    updater.availableVersion = '2.0.0'
    // autoUpdater is not created

    expect(() => updater.fetchUpdate()).not.toThrow()
    expect(mockLog.warn).toHaveBeenCalled()
  })
})

// ─── quitAndInstall() ─────────────────────────────────────────────────────────

describe('quitAndInstall()', () => {
  it('delegates to autoUpdater when installerReady is true', () => {
    updater.checkForAutoUpdate()
    const instance = updater.autoUpdater

    updater.installerReady = true

    updater.quitAndInstall()

    expect(instance.quitAndInstall).toHaveBeenCalled()
  })

  it('is a no-op when not ready', () => {
    updater.checkForAutoUpdate()
    const instance = updater.autoUpdater

    updater.installerReady = false

    updater.quitAndInstall()

    expect(instance.quitAndInstall).not.toHaveBeenCalled()
  })

  it('logs a warning when installerReady but no autoUpdater', () => {
    updater.installerReady = true
    // autoUpdater is not created

    expect(() => updater.quitAndInstall()).not.toThrow()
    expect(mockLog.warn).toHaveBeenCalled()
  })
})

// ─── get updateReady ─────────────────────────────────────────────────────────

describe('get updateReady', () => {
  it('returns false by default', () => {
    expect(updater.updateReady).toBe(false)
  })

  it('returns true after readyForInstall is called', () => {
    updater.readyForInstall()
    expect(updater.updateReady).toBe(true)
  })
})

// ─── dismissUpdate() ─────────────────────────────────────────────────────────

describe('dismissUpdate()', () => {
  it('clears availableVersion and availableUpdate', () => {
    updater.availableVersion = '2.0.0'
    updater.availableUpdate = 'https://example.com/release'

    updater.dismissUpdate()

    expect(updater.availableVersion).toBe('')
    expect(updater.availableUpdate).toBe('')
  })
})

// ─── updateAvailable() ───────────────────────────────────────────────────────

describe('updateAvailable()', () => {
  it('stores version and location, calls updateBadge with updateAvailable', () => {
    updater.updateAvailable('2.0.0', 'https://example.com/release')

    expect(updater.availableVersion).toBe('2.0.0')
    expect(updater.availableUpdate).toBe('https://example.com/release')
    expect(mockUpdateBadge).toHaveBeenCalledWith('updateAvailable', '2.0.0')
  })

  it('skips updateBadge notification if version is in dontRemind', () => {
    mockStore.main.updater.dontRemind = ['2.0.0']

    updater.updateAvailable('2.0.0', 'https://example.com/release')

    expect(updater.availableVersion).toBe('2.0.0')
    expect(mockUpdateBadge).not.toHaveBeenCalled()
  })

  it('is a no-op for the same version called twice (notified tracking)', () => {
    updater.updateAvailable('2.0.0', 'https://example.com/release')
    updater.updateAvailable('2.0.0', 'https://example.com/release')

    expect(mockUpdateBadge).toHaveBeenCalledTimes(1)
  })
})

// ─── checkForAutoUpdate() ────────────────────────────────────────────────────

describe('checkForAutoUpdate()', () => {
  it('creates AutoUpdater, binds events, and calls checkForUpdates', () => {
    updater.checkForAutoUpdate()

    const instance = updater.autoUpdater
    expect(instance).toBeDefined()
    expect(instance.checkForUpdates).toHaveBeenCalled()
  })

  it('reuses existing AutoUpdater on subsequent calls', () => {
    updater.checkForAutoUpdate()
    const first = updater.autoUpdater

    updater.checkForAutoUpdate()
    const second = updater.autoUpdater

    expect(first).toBe(second)
    expect(first.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('update-available event calls updateAvailable with version and location', () => {
    const updateAvailableSpy = jest.spyOn(updater, 'updateAvailable')
    updater.checkForAutoUpdate()

    updater.autoUpdater.emit('update-available', { version: '2.0.0', location: 'auto' })

    expect(updateAvailableSpy).toHaveBeenCalledWith('2.0.0', 'auto')
  })

  it('error event falls back to manual check', async () => {
    mockManualCheck.mockResolvedValue(undefined)

    updater.checkForAutoUpdate()
    updater.autoUpdater.emit('error', new Error('auto update failed'))

    // let async checkForManualUpdate run
    await Promise.resolve()

    expect(mockManualCheck).toHaveBeenCalled()
  })

  it('update-not-available event falls back to manual check', async () => {
    mockManualCheck.mockResolvedValue(undefined)

    updater.checkForAutoUpdate()
    updater.autoUpdater.emit('update-not-available')

    await Promise.resolve()

    expect(mockManualCheck).toHaveBeenCalled()
  })

  it('update-downloaded event calls readyForInstall', () => {
    const readyForInstallSpy = jest.spyOn(updater, 'readyForInstall')
    updater.checkForAutoUpdate()

    updater.autoUpdater.emit('update-downloaded')

    expect(readyForInstallSpy).toHaveBeenCalled()
    expect(updater.updateReady).toBe(true)
    expect(mockUpdateBadge).toHaveBeenCalledWith('updateReady')
  })

  it('update-downloaded event is ignored if installer already ready', () => {
    updater.checkForAutoUpdate()
    updater.installerReady = true

    updater.autoUpdater.emit('update-downloaded')

    // updateBadge should NOT be called again
    expect(mockUpdateBadge).not.toHaveBeenCalled()
  })

  it('error event resets installerReady to false', () => {
    mockManualCheck.mockResolvedValue(undefined)
    updater.checkForAutoUpdate()
    updater.installerReady = true

    updater.autoUpdater.emit('error', new Error('auto update failed'))

    expect(updater.installerReady).toBe(false)
  })

  it('exit event clears autoUpdater reference', () => {
    updater.checkForAutoUpdate()
    expect(updater.autoUpdater).toBeDefined()

    updater.autoUpdater.emit('exit')

    expect(updater.autoUpdater).toBeUndefined()
  })
})

// ─── checkForManualUpdate() ──────────────────────────────────────────────────

describe('checkForManualUpdate()', () => {
  it('calls updateAvailable with version and location when update found', async () => {
    const updateAvailableSpy = jest.spyOn(updater, 'updateAvailable')
    mockManualCheck.mockResolvedValue({ version: '2.0.0', location: 'https://example.com/release' })

    await updater.checkForManualUpdate()

    expect(updateAvailableSpy).toHaveBeenCalledWith('2.0.0', 'https://example.com/release')
  })

  it('logs info and does not call updateAvailable when no update found', async () => {
    const updateAvailableSpy = jest.spyOn(updater, 'updateAvailable')
    mockManualCheck.mockResolvedValue(undefined)

    await updater.checkForManualUpdate()

    expect(updateAvailableSpy).not.toHaveBeenCalled()
    expect(mockLog.info).toHaveBeenCalled()
  })

  it('catches and logs errors', async () => {
    mockManualCheck.mockRejectedValue(new Error('network error'))

    await expect(updater.checkForManualUpdate()).resolves.toBeUndefined()
    expect(mockLog.error).toHaveBeenCalled()
  })
})

// ─── fallback chain ───────────────────────────────────────────────────────────

describe('fallback chain: auto check failure → manual check', () => {
  it('switches to manual check when auto check errors', async () => {
    mockManualCheck.mockResolvedValue(undefined)

    updater.checkForAutoUpdate()
    updater.autoUpdater.emit('error', new Error('failed'))

    await Promise.resolve()

    expect(mockManualCheck).toHaveBeenCalled()
  })

  it('resets dismissUpdate state before calling manual check on fallback', async () => {
    mockManualCheck.mockResolvedValue(undefined)

    updater.availableVersion = '1.0.0'
    updater.availableUpdate = 'https://old-url.com'

    updater.checkForAutoUpdate()
    updater.autoUpdater.emit('update-not-available')

    await Promise.resolve()

    // dismissUpdate should have cleared the state
    expect(updater.availableVersion).toBe('')
    expect(updater.availableUpdate).toBe('')
  })
})

// ─── stopUpdates() cleanup ────────────────────────────────────────────────────

describe('stopUpdates() cleans up ALL resources', () => {
  it('clears setupCheck timeout', () => {
    updater.start()
    expect(updater.setupCheck).toBeDefined()

    updater.stop()
    expect(updater.setupCheck).toBeUndefined()
  })

  it('clears pendingCheck interval', () => {
    const manualSpy = jest.spyOn(updater, 'checkForManualUpdate').mockResolvedValue(undefined)
    const autoSpy = jest.spyOn(updater, 'checkForAutoUpdate').mockImplementation(() => {})

    updater.start()
    jest.advanceTimersByTime(10_000) // trigger first check + set up interval
    expect(updater.pendingCheck).toBeDefined()

    updater.stop()
    expect(updater.pendingCheck).toBeUndefined()

    manualSpy.mockClear()
    autoSpy.mockClear()

    jest.advanceTimersByTime(UPDATE_INTERVAL)
    expect(manualSpy).not.toHaveBeenCalled()
    expect(autoSpy).not.toHaveBeenCalled()
  })

  it('closes and clears autoUpdater', () => {
    updater.checkForAutoUpdate()
    const instance = updater.autoUpdater
    expect(instance).toBeDefined()

    updater.stop()

    expect(instance.close).toHaveBeenCalled()
    expect(updater.autoUpdater).toBeUndefined()
  })
})
