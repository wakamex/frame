import RpcHealthChecker from '../../../../main/chains/health'

jest.mock('electron-log', () => ({
  debug: jest.fn(),
  error: jest.fn()
}))

describe('RpcHealthChecker', () => {
  let send, onHealth, checker

  beforeEach(() => {
    jest.useFakeTimers()
    send = jest.fn()
    onHealth = jest.fn()
    checker = new RpcHealthChecker(send, onHealth)
  })

  afterEach(() => {
    checker.stop()
    jest.useRealTimers()
  })

  describe('constructor', () => {
    it('stores send and onHealth callbacks', () => {
      // Verify by observing their usage in start/check
      expect(typeof checker.start).toBe('function')
      expect(typeof checker.stop).toBe('function')

      // Trigger a check and verify the send function is called
      checker.start()
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'eth_blockNumber' }),
        expect.any(Function)
      )
    })
  })

  describe('start()', () => {
    it('calls check() immediately (sends eth_blockNumber)', () => {
      checker.start()
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: []
        }),
        expect.any(Function)
      )
    })

    it('starts a 30s polling interval', () => {
      checker.start()
      expect(send).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(2)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(3)
    })

    it('is a no-op when already started (idempotent)', () => {
      checker.start()
      checker.start()
      checker.start()

      expect(send).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(2)
    })
  })

  describe('stop()', () => {
    it('clears the polling interval and resets consecutiveErrors', () => {
      checker.start()
      expect(send).toHaveBeenCalledTimes(1)

      // Simulate some errors to increment consecutiveErrors
      const cb = send.mock.calls[0][1]
      cb(new Error('network error'))
      expect(onHealth).toHaveBeenCalledWith(expect.objectContaining({ consecutiveErrors: 1 }))

      checker.stop()

      // No more calls after stop
      jest.advanceTimersByTime(90_000)
      expect(send).toHaveBeenCalledTimes(1)

      // After stop() and restart, consecutiveErrors should be reset
      checker.start()
      const cb2 = send.mock.calls[1][1]
      cb2(null, { result: '0x123' })
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 0, status: 'healthy' })
      )
    })
  })

  describe('classify() via check()', () => {
    function triggerCheckWithLatency(latencyMs, hasError = false) {
      let nowValue = 1000
      const dateSpy = jest.spyOn(Date, 'now')
      dateSpy.mockReturnValueOnce(nowValue) // start time (check call)
      dateSpy.mockReturnValue(nowValue + latencyMs) // end time (callback + lastChecked)

      checker.start()
      const cb = send.mock.calls[0][1]
      if (hasError) {
        cb(new Error('rpc error'))
      } else {
        cb(null, { result: '0x1' })
      }

      dateSpy.mockRestore()
    }

    it('classifies as healthy when latency <2000ms and no errors', () => {
      triggerCheckWithLatency(500)
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'healthy', latencyMs: 500 })
      )
    })

    it('classifies as degraded when latency is between 2000ms and 5000ms', () => {
      triggerCheckWithLatency(3000)
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'degraded', latencyMs: 3000 })
      )
    })

    it('classifies as down when latency >5000ms', () => {
      triggerCheckWithLatency(6000)
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'down', latencyMs: 6000 })
      )
    })

    it('classifies as down when 3+ consecutive errors', () => {
      // Trigger 3 errors
      for (let i = 0; i < 3; i++) {
        send.mockClear()
        onHealth.mockClear()
        // Each call to check() happens via interval advance after first start
        if (i === 0) {
          checker.start()
        } else {
          jest.advanceTimersByTime(30_000)
        }
        const cb = send.mock.calls[0][1]
        cb(new Error('error'))
      }

      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'down', consecutiveErrors: 3 })
      )
    })
  })

  describe('check() behavior', () => {
    it('resets consecutiveErrors to 0 on a successful check', () => {
      checker.start()

      // First check - error
      let cb = send.mock.calls[0][1]
      cb(new Error('fail'))
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 1 })
      )

      // Second check - success
      jest.advanceTimersByTime(30_000)
      cb = send.mock.calls[1][1]
      cb(null, { result: '0x1' })
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 0, status: 'healthy' })
      )
    })

    it('increments consecutiveErrors when callback receives an err', () => {
      checker.start()
      const cb = send.mock.calls[0][1]
      cb(new Error('network error'))
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({ consecutiveErrors: 1 })
      )
    })

    it('increments consecutiveErrors when result has an error field', () => {
      checker.start()
      const cb = send.mock.calls[0][1]
      cb(null, { error: { code: -32000, message: 'execution error' } })
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({ consecutiveErrors: 1 })
      )
    })

    it('catches thrown errors from send(), increments consecutiveErrors, calls onHealth', () => {
      send.mockImplementation(() => {
        throw new Error('send threw')
      })

      checker.start()

      expect(onHealth).toHaveBeenCalledTimes(1)
      expect(onHealth).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveErrors: 1,
          status: 'down'
        })
      )
    })
  })

  describe('multiple polls', () => {
    it('advancing timer by 30s repeatedly triggers check each time', () => {
      checker.start()
      expect(send).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(2)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(3)

      jest.advanceTimersByTime(30_000)
      expect(send).toHaveBeenCalledTimes(4)
    })
  })

  describe('error recovery', () => {
    it('resets consecutive errors to 0 after a successful check, reporting healthy status', () => {
      checker.start()

      // Two consecutive errors
      let cb = send.mock.calls[0][1]
      cb(new Error('err'))
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 1 })
      )

      jest.advanceTimersByTime(30_000)
      cb = send.mock.calls[1][1]
      cb(new Error('err'))
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 2 })
      )

      // Recovery: successful check
      jest.advanceTimersByTime(30_000)
      cb = send.mock.calls[2][1]
      cb(null, { result: '0xabc' })
      expect(onHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ consecutiveErrors: 0, status: 'healthy' })
      )
    })

    it('stop() prevents further checks from running', () => {
      checker.start()
      expect(send).toHaveBeenCalledTimes(1)

      checker.stop()

      jest.advanceTimersByTime(120_000)
      expect(send).toHaveBeenCalledTimes(1)
    })
  })
})
