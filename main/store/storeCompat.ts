/**
 * Zustand-based store with react-restore compatible API
 *
 * Provides the same interface as the old react-restore store:
 *   - store('path.to.value') — read state at a path
 *   - store.actionName(args) — dispatch actions
 *   - store.observer(callback, id?) — subscribe to state changes
 *   - store.api.feed(callback) — receive batched update notifications
 */

import { createStore } from 'zustand/vanilla'
import { produce } from 'immer'

// ---- Path-based state access ----

function getByPath(obj: any, pathParts: string[]): any {
  let current = obj
  for (const key of pathParts) {
    if (current === undefined || current === null) return undefined
    current = current[key]
  }
  return current
}

function setByPath(obj: any, pathParts: string[], value: any): void {
  let current = obj
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i]
    if (current[key] === undefined || current[key] === null) {
      current[key] = {}
    }
    current = current[key]
  }
  current[pathParts[pathParts.length - 1]] = value
}

/**
 * Parse the variadic path arguments used by react-restore's u() function.
 * Path segments can contain dots which get split further.
 * The last argument is always an updater function.
 *
 * Examples:
 *   u('main.launch', () => true)
 *   u('main.networks', type, chainId, 'on', () => active)
 *   u('main.networks', type, netId, 'connection.primary.current', () => value)
 */
function parsePathArgs(args: any[]): { pathParts: string[]; updater: (current: any) => any } {
  const updater = args[args.length - 1]
  const pathSegments = args.slice(0, -1)
  const pathParts = pathSegments.flatMap((seg: any) => String(seg).split('.'))
  return { pathParts, updater }
}

// ---- Types ----

type FeedCallback = (state: any, actionBatch: ActionBatch[]) => void
type ObserverCallback = () => void

interface ActionBatch {
  updates: Array<{ path: string; value: any }>
}

interface Observer {
  callback: ObserverCallback
  id?: string
  remove: () => void
}

// ---- Store creation ----

export function createCompatStore(initialState: any, actions: Record<string, (...args: any[]) => void>) {
  // The underlying Zustand vanilla store
  const zustandStore = createStore<any>()(() => initialState)

  // Feed subscribers
  const feedCallbacks: FeedCallback[] = []

  // Pending updates for the current action batch
  let pendingUpdates: Array<{ path: string; value: any }> = []
  let batchDepth = 0

  /**
   * The update function (replaces react-restore's `u()`).
   * Applies an updater function at a specific path in the state tree.
   */
  function u(...args: any[]) {
    const { pathParts, updater } = parsePathArgs(args)

    zustandStore.setState(
      produce((draft: any) => {
        const currentValue = getByPath(draft, pathParts)
        const newValue = updater(currentValue)
        setByPath(draft, pathParts, newValue)
      })
    )

    // Track the update for feed callbacks
    const path = pathParts.join('.')
    const newState = zustandStore.getState()
    const value = getByPath(newState, pathParts)
    pendingUpdates.push({ path, value })
  }

  /**
   * Flush pending updates to feed subscribers.
   */
  function flushBatch() {
    if (pendingUpdates.length === 0) return

    const batch: ActionBatch = { updates: [...pendingUpdates] }
    pendingUpdates = []

    const state = zustandStore.getState()
    feedCallbacks.forEach((cb) => {
      try {
        cb(state, [batch])
      } catch (e) {
        console.error('Feed callback error:', e)
      }
    })
  }

  /**
   * Wrap each action so that:
   * 1. The `u` update function is injected as the first argument
   * 2. Updates are batched and flushed after the action completes
   */
  const boundActions: Record<string, (...args: any[]) => void> = {}

  for (const [name, actionFn] of Object.entries(actions)) {
    boundActions[name] = (...args: any[]) => {
      batchDepth++
      try {
        actionFn(u, ...args)
      } finally {
        batchDepth--
        if (batchDepth === 0) {
          flushBatch()
        }
      }
    }
  }

  // ---- Observer system ----

  const observers: Observer[] = []

  // Subscribe to zustand changes and notify all observers
  // Re-entrancy guard prevents infinite recursion when observer callbacks trigger state updates
  let notifying = false
  zustandStore.subscribe(() => {
    if (notifying) return
    notifying = true
    try {
      for (const observer of observers) {
        try {
          observer.callback()
        } catch (e) {
          console.error('Observer error:', e)
        }
      }
    } finally {
      notifying = false
    }
  })

  // ---- Build the callable store proxy ----

  /**
   * The store function: store('path.to.value') returns the value at that path.
   * Also supports variadic path segments: store('main.networks', type, id, 'explorer')
   */
  function storeAccessor(...args: any[]): any {
    const pathParts = args.flatMap((seg: any) => String(seg).split('.'))
    const state = zustandStore.getState()
    return getByPath(state, pathParts)
  }

  // Attach action methods, observer, api, and getState to the accessor function
  const store = Object.assign(storeAccessor, boundActions, {
    observer(callback: ObserverCallback, id?: string): Observer {
      const obs: Observer = {
        callback,
        id,
        remove: () => {
          const index = observers.indexOf(obs)
          if (index >= 0) observers.splice(index, 1)
        }
      }
      observers.push(obs)
      return obs
    },

    api: {
      feed(callback: FeedCallback) {
        feedCallbacks.push(callback)
      }
    },

    // Expose internals for testing/debugging
    getState: () => zustandStore.getState(),
    setState: (partial: any) => zustandStore.setState(partial),
    subscribe: (listener: (state: any, prevState: any) => void) => zustandStore.subscribe(listener)
  })

  return store
}
