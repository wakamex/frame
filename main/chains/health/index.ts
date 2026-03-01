import log from 'electron-log'

export type RpcHealthStatus = 'healthy' | 'degraded' | 'down'

export interface RpcHealth {
  latencyMs: number
  lastChecked: number
  status: RpcHealthStatus
  consecutiveErrors: number
}

export type SendFn = (
  payload: { jsonrpc: string; method: string; params: any[]; id: number },
  cb: (err: Error | null, result?: { result?: string; error?: any }) => void
) => void

export type HealthCallback = (health: RpcHealth) => void

const POLL_INTERVAL_MS = 30_000
const HEALTHY_THRESHOLD_MS = 2_000
const DEGRADED_THRESHOLD_MS = 5_000
const ERROR_COUNT_FOR_DOWN = 3

function classify(latencyMs: number, consecutiveErrors: number): RpcHealthStatus {
  if (consecutiveErrors >= ERROR_COUNT_FOR_DOWN) return 'down'
  if (latencyMs > DEGRADED_THRESHOLD_MS) return 'down'
  if (latencyMs > HEALTHY_THRESHOLD_MS) return 'degraded'
  return 'healthy'
}

export default class RpcHealthChecker {
  private send: SendFn
  private onHealth: HealthCallback
  private timer: ReturnType<typeof setInterval> | null = null
  private consecutiveErrors = 0

  constructor(send: SendFn, onHealth: HealthCallback) {
    this.send = send
    this.onHealth = onHealth
  }

  start() {
    if (this.timer) return
    this.check()
    this.timer = setInterval(() => this.check(), POLL_INTERVAL_MS)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.consecutiveErrors = 0
  }

  private check() {
    const start = Date.now()

    try {
      this.send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: Date.now() }, (err, result) => {
        const latencyMs = Date.now() - start

        if (err || result?.error) {
          this.consecutiveErrors++
          log.debug('RPC health check failed', { err, error: result?.error })
        } else {
          this.consecutiveErrors = 0
        }

        const status = classify(latencyMs, this.consecutiveErrors)

        this.onHealth({
          latencyMs,
          lastChecked: Date.now(),
          status,
          consecutiveErrors: this.consecutiveErrors
        })
      })
    } catch (e) {
      this.consecutiveErrors++
      this.onHealth({
        latencyMs: Date.now() - start,
        lastChecked: Date.now(),
        status: classify(Infinity, this.consecutiveErrors),
        consecutiveErrors: this.consecutiveErrors
      })
    }
  }
}
