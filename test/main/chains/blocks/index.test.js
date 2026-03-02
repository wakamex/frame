jest.mock('electron-log', () => ({
  verbose: jest.fn(),
  debug: jest.fn(),
  error: jest.fn()
}))

import { EventEmitter } from 'events'
import BlockMonitor from '../../../../main/chains/blocks/index'

// Flush all pending promise microtasks (process.nextTick is faked by fake timers,
// so use Promise.resolve() which goes through the microtask queue instead)
const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function createMockConnection(chainId = '0x1') {
  const connection = new EventEmitter()
  connection.send = jest.fn()
  connection.chainId = chainId
  return connection
}

function makeBlock(number = '0x1') {
  return { number, hash: '0xabc', parentHash: '0x000' }
}

describe('BlockMonitor', () => {
  let connection
  let monitor

  beforeEach(() => {
    connection = createMockConnection('0x1')
    // Default: send resolves with undefined (subscription not supported = fallback path)
    // Individual tests override this as needed
    connection.send.mockResolvedValue(undefined)
    monitor = new BlockMonitor(connection)
  })

  describe('constructor', () => {
    it('binds to connection "connect" event', () => {
      expect(connection.listeners('connect')).toContain(monitor.start)
    })

    it('binds to connection "close" event', () => {
      expect(connection.listeners('close')).toContain(monitor.stop)
    })

    it('initializes latestBlock to 0x0', () => {
      expect(monitor.latestBlock).toBe('0x0')
    })
  })

  describe('chainId getter', () => {
    it('parses hex chainId from connection to integer', () => {
      connection.chainId = '0xa'
      expect(monitor.chainId).toBe(10)
    })

    it('parses chainId 0x1 as 1', () => {
      connection.chainId = '0x1'
      expect(monitor.chainId).toBe(1)
    })

    it('parses chainId 0x89 (137) correctly', () => {
      connection.chainId = '0x89'
      expect(monitor.chainId).toBe(137)
    })
  })

  describe('start()', () => {
    it('calls getLatestBlock immediately by calling send with eth_getBlockByNumber', async () => {
      connection.send.mockResolvedValue(null)
      monitor.start()

      expect(connection.send).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'eth_getBlockByNumber', params: ['latest', false] })
      )
    })

    it('subscribes via eth_subscribe newHeads', async () => {
      connection.send.mockResolvedValue(null)
      monitor.start()

      expect(connection.send).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'eth_subscribe', params: ['newHeads'] })
      )
    })

    it('stores the subscriptionId on subscription success', async () => {
      const subId = 'sub-123'
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve(subId)
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.subscriptionId).toBe(subId)
    })

    it('uses message-based updates after subscription success (no poller)', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve('sub-456')
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.poller).toBeUndefined()
    })

    it('falls back to 15s polling interval when subscription fails', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.poller).toBeDefined()
    })

    it('clears message listener on subscription failure (fallback to polling)', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(connection.listeners('message')).not.toContain(monitor.handleMessage)
    })

    it('listens for "message" events on start', () => {
      monitor.start()

      // The message listener should be registered before the async subscribe resolves
      expect(connection.listeners('message').length).toBeGreaterThan(0)
    })
  })

  describe('stop()', () => {
    it('clears the subscription when subscriptionId is set', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve('sub-789')
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.subscriptionId).toBe('sub-789')

      monitor.stop()

      expect(monitor.subscriptionId).toBe('')
    })

    it('removes message listener when stopping with a subscription', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve('sub-abc')
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()
      monitor.stop()

      expect(connection.listeners('message')).not.toContain(monitor.handleMessage)
    })

    it('clears the polling interval when poller is set', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.poller).toBeDefined()

      monitor.stop()

      expect(monitor.poller).toBeUndefined()
    })

    it('does not throw when called with no active subscription or poller', () => {
      expect(() => monitor.stop()).not.toThrow()
    })
  })

  describe('handleBlock (via getLatestBlock)', () => {
    it('emits "data" event when a new block number is received', async () => {
      const block = makeBlock('0x5')
      connection.send.mockResolvedValue(block)

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      monitor.start()
      await flushPromises()

      expect(dataHandler).toHaveBeenCalledWith(block)
    })

    it('updates latestBlock when a new block is received', async () => {
      const block = makeBlock('0x5')
      connection.send.mockResolvedValue(block)

      monitor.start()
      await flushPromises()

      expect(monitor.latestBlock).toBe('0x5')
    })

    it('does NOT emit "data" when block number equals latestBlock', async () => {
      const block = makeBlock('0x0') // same as initial latestBlock
      connection.send.mockResolvedValue(block)

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      monitor.start()
      await flushPromises()

      expect(dataHandler).not.toHaveBeenCalled()
    })

    it('emits "status:connected" on connection when a valid new block is received', async () => {
      const block = makeBlock('0x5')
      connection.send.mockResolvedValue(block)

      const statusHandler = jest.fn()
      connection.on('status', statusHandler)

      monitor.start()
      await flushPromises()

      expect(statusHandler).toHaveBeenCalledWith('connected')
    })

    it('calls handleError when block is null', async () => {
      connection.send.mockResolvedValue(null)

      const statusHandler = jest.fn()
      connection.on('status', statusHandler)

      monitor.start()
      await flushPromises()

      expect(statusHandler).toHaveBeenCalledWith('degraded')
    })

    it('calls handleError when block is not an object (string)', async () => {
      connection.send.mockResolvedValue('not-a-block')

      const statusHandler = jest.fn()
      connection.on('status', statusHandler)

      monitor.start()
      await flushPromises()

      expect(statusHandler).toHaveBeenCalledWith('degraded')
    })

    it('does not emit "data" for duplicate block number', async () => {
      const block = makeBlock('0x5')
      connection.send.mockResolvedValue(block)

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      // First call: block is new
      monitor.latestBlock = '0x5'

      monitor.start()
      await flushPromises()

      // Block number matches latestBlock, so 'data' should not be emitted
      expect(dataHandler).not.toHaveBeenCalled()
    })
  })

  describe('handleError', () => {
    it('emits "status:degraded" on connection when called', async () => {
      // getLatestBlock sends then handleBlock runs; cause handleError via invalid block
      connection.send.mockResolvedValue(null)

      const statusHandler = jest.fn()
      connection.on('status', statusHandler)

      monitor.start()
      await flushPromises()

      expect(statusHandler).toHaveBeenCalledWith('degraded')
    })

    it('emits "status:degraded" when getLatestBlock send rejects', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_getBlockByNumber') return Promise.reject(new Error('network error'))
        return Promise.resolve(null)
      })

      const statusHandler = jest.fn()
      connection.on('status', statusHandler)

      monitor.start()
      await flushPromises()

      expect(statusHandler).toHaveBeenCalledWith('degraded')
    })
  })

  describe('handleMessage', () => {
    it('processes subscription messages that match the subscriptionId', async () => {
      const subId = 'sub-match'
      const block = makeBlock('0xa')

      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve(subId)
        return Promise.resolve(null)
      })

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      monitor.start()
      await flushPromises()

      // Now emit a message that matches the subscription
      connection.emit('message', {
        type: 'eth_subscription',
        data: { subscription: subId, result: block }
      })

      expect(dataHandler).toHaveBeenCalledWith(block)
    })

    it('ignores subscription messages that do not match the subscriptionId', async () => {
      const subId = 'sub-match'
      const block = makeBlock('0xb')

      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve(subId)
        return Promise.resolve(null)
      })

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      monitor.start()
      await flushPromises()

      // Reset the data handler since start() may have triggered one via getLatestBlock
      dataHandler.mockClear()

      // Emit a message with a DIFFERENT subscription id
      connection.emit('message', {
        type: 'eth_subscription',
        data: { subscription: 'wrong-sub-id', result: block }
      })

      expect(dataHandler).not.toHaveBeenCalled()
    })

    it('ignores messages with wrong type', async () => {
      const subId = 'sub-match'
      const block = makeBlock('0xc')

      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve(subId)
        return Promise.resolve(null)
      })

      const dataHandler = jest.fn()
      monitor.on('data', dataHandler)

      monitor.start()
      await flushPromises()
      dataHandler.mockClear()

      connection.emit('message', {
        type: 'not_eth_subscription',
        data: { subscription: subId, result: block }
      })

      expect(dataHandler).not.toHaveBeenCalled()
    })
  })

  describe('connection "close" event', () => {
    it('triggers stop() when connection emits "close"', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.resolve('sub-close-test')
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.subscriptionId).toBe('sub-close-test')

      connection.emit('close')

      expect(monitor.subscriptionId).toBe('')
    })

    it('clears poller when connection closes during polling mode', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      expect(monitor.poller).toBeDefined()

      connection.emit('close')

      expect(monitor.poller).toBeUndefined()
    })
  })

  describe('polling fallback', () => {
    it('triggers getLatestBlock again after 15s when polling', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      const callCountAfterStart = connection.send.mock.calls.length

      // Advance timers by 15 seconds to trigger the poller
      jest.advanceTimersByTime(15000)
      await flushPromises()

      const callCountAfterPoll = connection.send.mock.calls.length

      // At least one more call to eth_getBlockByNumber should have happened
      expect(callCountAfterPoll).toBeGreaterThan(callCountAfterStart)
      expect(connection.send).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'eth_getBlockByNumber' })
      )
    })

    it('does NOT trigger additional getLatestBlock after stop() clears the poller', async () => {
      connection.send.mockImplementation(({ method }) => {
        if (method === 'eth_subscribe') return Promise.reject(new Error('not supported'))
        return Promise.resolve(null)
      })

      monitor.start()
      await flushPromises()

      monitor.stop()

      const callCountAfterStop = connection.send.mock.calls.length

      // Advance timers — no more polls should fire
      jest.advanceTimersByTime(15000)
      await flushPromises()

      expect(connection.send.mock.calls.length).toBe(callCountAfterStop)
    })
  })
})
