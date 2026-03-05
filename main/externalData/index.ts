import log from 'electron-log'

import { subscribe } from 'valtio'

import state from '../store'
import Rates from './assets'
import Balances from './balances'
import { arraysMatch, debounce } from '../../resources/utils'

import type { Chain, Token } from '../store/state'

export interface DataScanner {
  close: () => void
}

const storeApi = {
  getActiveAddress: () => ((state as any).selected?.current || '') as Address,
  getAllAddresses: () => Object.keys(state.main.accounts || {}) as Address[],
  getCustomTokens: () => (state.main.tokens.custom || []) as Token[],
  getKnownTokens: (address?: Address) => ((address && (state.main.tokens.known as any)?.[address]) || []) as Token[],
  getConnectedNetworks: () => {
    const networks = Object.values(state.main.networks.ethereum || {}) as Chain[]
    return networks.filter(
      (n) => (n.connection.primary || {}).connected || (n.connection.secondary || {}).connected
    )
  }
}

export default function () {
  const rates = Rates(state)
  const balances = Balances(state)

  let connectedChains: number[] = [],
    activeAccount: Address = ''
  let pauseScanningDelay: NodeJS.Timeout | undefined

  rates.start()
  balances.start()

  let backgroundScanTimers: NodeJS.Timeout[] = []

  const handleNetworkUpdate = debounce((newlyConnected: number[]) => {
    log.verbose('updating external data due to network update(s)', { connectedChains, newlyConnected })

    rates.updateSubscription(connectedChains, activeAccount)

    if (newlyConnected.length > 0) {
      // Scan all accounts on newly connected networks.
      // Active account scans immediately; others are staggered to avoid
      // overwhelming the RPC with thousands of concurrent multicalls.
      const addresses = storeApi.getAllAddresses()

      // Clear any pending background scans from a previous network event
      for (const t of backgroundScanTimers) clearTimeout(t)
      backgroundScanTimers = []

      let delay = 0
      for (const address of addresses) {
        if (address === activeAccount) {
          balances.addNetworks(address, newlyConnected)
        } else {
          delay += 5_000 // 5s between each background account
          backgroundScanTimers.push(
            setTimeout(() => balances.addNetworks(address, newlyConnected), delay)
          )
        }
      }
    }
  }, 500)

  const handleAddressUpdate = debounce(() => {
    log.verbose('updating external data due to address update(s)', { activeAccount })

    balances.setAddress(activeAccount)
    rates.updateSubscription(connectedChains, activeAccount)
  }, 800)

  const handleTokensUpdate = debounce((tokens: Token[]) => {
    log.verbose('updating external data due to token update(s)', { activeAccount })

    if (activeAccount) {
      balances.addTokens(activeAccount, tokens)
    }

    rates.updateSubscription(connectedChains, activeAccount)
  })

  const unsubNetworks = subscribe(state, () => {
    const connectedNetworkIds = storeApi
      .getConnectedNetworks()
      .map((n) => n.id)
      .sort()

    if (!arraysMatch(connectedChains, connectedNetworkIds)) {
      const newlyConnectedNetworks = connectedNetworkIds.filter((c) => !connectedChains.includes(c))
      connectedChains = connectedNetworkIds

      handleNetworkUpdate(newlyConnectedNetworks)
    }
  })

  const unsubActiveAddress = subscribe(state, () => {
    const activeAddress = storeApi.getActiveAddress()
    const knownTokens = storeApi.getKnownTokens(activeAddress)

    if (activeAddress !== activeAccount) {
      activeAccount = activeAddress
      handleAddressUpdate()
    } else {
      handleTokensUpdate(knownTokens)
    }
  })

  const unsubCustomTokens = subscribe(state, () => {
    const customTokens = storeApi.getCustomTokens()
    handleTokensUpdate(customTokens)
  })

  // Track balance-derived token addresses so we re-fetch rates when new tokens appear
  let balanceTokenKeys = new Set<string>()

  const handleBalancesUpdate = debounce(() => {
    log.verbose('updating rates due to new balance tokens')
    rates.updateSubscription(connectedChains, activeAccount)
  }, 1500)

  const unsubBalances = subscribe(state, () => {
    const allBalances: Record<string, any[]> = (state.main.balances as any) || {}
    const keys = new Set<string>()
    for (const acctBalances of Object.values(allBalances)) {
      for (const b of acctBalances) {
        if (b.address && b.chainId) keys.add(`${b.chainId}:${b.address}`)
      }
    }

    // Only trigger if new tokens appeared
    let hasNew = false
    for (const key of keys) {
      if (!balanceTokenKeys.has(key)) {
        hasNew = true
        break
      }
    }

    balanceTokenKeys = keys

    if (hasNew) {
      handleBalancesUpdate()
    }
  })

  const unsubTray = subscribe(state, () => {
    const open = (state as any).tray?.open

    if (!open) {
      // pause balance scanning after the tray is out of view for one minute
      if (!pauseScanningDelay) {
        pauseScanningDelay = setTimeout(balances.pause, 1000)
      }
    } else {
      if (pauseScanningDelay) {
        clearTimeout(pauseScanningDelay)
        pauseScanningDelay = undefined

        balances.resume()
      }
    }
  })

  return {
    close: () => {
      unsubNetworks()
      unsubActiveAddress()
      unsubCustomTokens()
      unsubBalances()
      unsubTray()

      for (const t of backgroundScanTimers) clearTimeout(t)
      backgroundScanTimers = []

      rates.stop()
      balances.stop()

      if (pauseScanningDelay) {
        clearTimeout(pauseScanningDelay)
      }
    }
  } as DataScanner
}
