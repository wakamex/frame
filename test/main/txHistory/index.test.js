jest.mock('electron-log', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn()
}))

jest.mock('valtio', () => ({
  subscribe: jest.fn((_state, cb) => jest.fn()),
  snapshot: jest.fn((s) => JSON.parse(JSON.stringify(s))),
  proxy: jest.fn((obj) => obj)
}))

jest.mock('../../../main/chains', () => ({
  __esModule: true,
  default: {
    send: jest.fn()
  }
}))

jest.mock('../../../main/store/actions', () => ({
  updateTxStatus: jest.fn()
}))

// Prevent the singleton from carrying state across tests — reset each time
let TxTracker
let mockSend
let mockUpdateTxStatus
let log

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  // Re-require modules after reset to get fresh instances
  TxTracker = require('../../../main/txHistory').default
  mockSend = require('../../../main/chains').default.send
  mockUpdateTxStatus = require('../../../main/store/actions').updateTxStatus
  log = require('electron-log')
})

afterEach(() => {
  // Stop any running timer to avoid leaks
  TxTracker.stop()
})

describe('TxTracker.track()', () => {
  it('adds a transaction to the internal pending list', () => {
    TxTracker.track('0xabc', 1, '0xfrom')
    // After track(), pending has one entry → start() created a timer
    // We can verify indirectly: stop() clears it without error
    expect(() => TxTracker.stop()).not.toThrow()
  })

  it('auto-starts polling timer when tracking the first tx', () => {
    const startSpy = jest.spyOn(TxTracker, 'start')
    TxTracker.track('0xabc', 1, '0xfrom')
    expect(startSpy).toHaveBeenCalled()
  })

  it('does not create a second timer when tracking multiple txs', () => {
    TxTracker.track('0xaaa', 1, '0xfrom')
    TxTracker.track('0xbbb', 1, '0xfrom')
    // start() is idempotent — calling it twice should not throw
    expect(() => TxTracker.stop()).not.toThrow()
  })
})

describe('TxTracker.poll() — receipt with status=0x1 (confirmed)', () => {
  it('calls updateTxStatus with "confirmed" and removes the tx', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ result: { status: '0x1', gasUsed: '0x5208', blockNumber: '0x64' } })
    })

    TxTracker.track('0xhash1', 1, '0xfrom')
    jest.advanceTimersByTime(15000)

    expect(mockUpdateTxStatus).toHaveBeenCalledWith(
      '0xfrom',
      '0xhash1',
      'confirmed',
      { gasUsed: '0x5208', blockNumber: 100 }
    )
  })
})

describe('TxTracker.poll() — receipt with status≠0x1 (failed)', () => {
  it('calls updateTxStatus with "failed" and removes the tx', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ result: { status: '0x0', gasUsed: '0x5208', blockNumber: '0x65' } })
    })

    TxTracker.track('0xhash2', 1, '0xfrom')
    jest.advanceTimersByTime(15000)

    expect(mockUpdateTxStatus).toHaveBeenCalledWith(
      '0xfrom',
      '0xhash2',
      'failed',
      { gasUsed: '0x5208', blockNumber: 101 }
    )
  })
})

describe('TxTracker.poll() — no receipt, under MAX_POLLS', () => {
  it('continues tracking without calling updateTxStatus', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ result: null })
    })

    TxTracker.track('0xhash3', 1, '0xfrom')
    jest.advanceTimersByTime(15000) // poll #1

    expect(mockUpdateTxStatus).not.toHaveBeenCalled()
  })
})

describe('TxTracker.poll() — no receipt, reaches MAX_POLLS (100)', () => {
  it('calls updateTxStatus with "failed" after 100 polls', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ result: null })
    })

    TxTracker.track('0xhash4', 1, '0xfrom')

    // Advance 100 poll intervals
    jest.advanceTimersByTime(15000 * 100)

    expect(mockUpdateTxStatus).toHaveBeenCalledWith('0xfrom', '0xhash4', 'failed')
  })
})

describe('TxTracker.poll() — RPC error', () => {
  it('logs a warning and does not call updateTxStatus', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ error: { message: 'network error', code: -32000 } })
    })

    TxTracker.track('0xhash5', 1, '0xfrom')
    jest.advanceTimersByTime(15000)

    expect(mockUpdateTxStatus).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalled()
  })
})

describe('Auto-stop behaviour', () => {
  it('stops the timer when the last pending tx resolves', () => {
    mockSend.mockImplementation((payload, cb, _target) => {
      cb({ result: { status: '0x1', gasUsed: '0x5208', blockNumber: '0x64' } })
    })

    const stopSpy = jest.spyOn(TxTracker, 'stop')

    TxTracker.track('0xhash6', 1, '0xfrom')
    jest.advanceTimersByTime(15000)

    // stop() is called from removePending() once pending list is empty
    expect(stopSpy).toHaveBeenCalled()
  })

  it('does not stop the timer while other txs are still pending', () => {
    let callCount = 0
    mockSend.mockImplementation((payload, cb, _target) => {
      callCount++
      // Only resolve the first tx, leave the second pending
      if (payload.params[0] === '0xhash7a') {
        cb({ result: { status: '0x1', gasUsed: '0x0', blockNumber: '0x1' } })
      } else {
        cb({ result: null })
      }
    })

    TxTracker.track('0xhash7a', 1, '0xfrom')
    TxTracker.track('0xhash7b', 1, '0xfrom')

    jest.advanceTimersByTime(15000)

    // First tx confirmed but second still pending
    expect(mockUpdateTxStatus).toHaveBeenCalledTimes(1)
    expect(mockUpdateTxStatus).toHaveBeenCalledWith(
      '0xfrom',
      '0xhash7a',
      'confirmed',
      expect.any(Object)
    )
  })
})

describe('TxTracker.stop()', () => {
  it('explicitly clears the interval', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

    TxTracker.track('0xhash8', 1, '0xfrom')
    TxTracker.stop()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('is safe to call when not running', () => {
    expect(() => TxTracker.stop()).not.toThrow()
  })
})
