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

  const handleNetworkUpdate = debounce((newlyConnected: number[]) => {
    log.verbose('updating external data due to network update(s)', { connectedChains, newlyConnected })

    rates.updateSubscription(connectedChains, activeAccount)

    if (newlyConnected.length > 0 && activeAccount) {
      balances.addNetworks(activeAccount, newlyConnected)
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
      unsubTray()

      rates.stop()
      balances.stop()

      if (pauseScanningDelay) {
        clearTimeout(pauseScanningDelay)
      }
    }
  } as DataScanner
}
