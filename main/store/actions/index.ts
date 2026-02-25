import log from 'electron-log'
import { v5 as uuidv5 } from 'uuid'
import { accountNS, isDefaultAccountName } from '../../../resources/domain/account'
import { toTokenId } from '../../../resources/domain/balance'

// react-restore update function type
type UpdateFn = (...args: any[]) => any

const supportedNetworkTypes = ['ethereum']

function switchChainForOrigins(origins: any, oldChainId: number, newChainId: number) {
  Object.entries(origins).forEach(([origin, { chain }]: [string, any]) => {
    if (oldChainId === chain.id) {
      origins[origin].chain = { id: newChainId, type: 'ethereum' }
    }
  })
}

function validateNetworkSettings(network: any): number {
  const networkId = parseInt(network.id)

  if (
    !Number.isInteger(networkId) ||
    typeof network.type !== 'string' ||
    typeof network.name !== 'string' ||
    typeof network.explorer !== 'string' ||
    typeof network.symbol !== 'string' ||
    !supportedNetworkTypes.includes(network.type)
  ) {
    throw new Error(`Invalid network settings: ${JSON.stringify(network)}`)
  }

  return networkId
}

function includesToken(tokens: any[], token: any): boolean {
  const existingAddress = token.address.toLowerCase()
  return tokens.some((t: any) => t.address.toLowerCase() === existingAddress && t.chainId === token.chainId)
}

export const activateNetwork = (u: UpdateFn, type: string, chainId: number, active: boolean) => {
  u('main.networks', type, chainId, 'on', () => active)

  if (!active) {
    u('main', (main: any) => {
      switchChainForOrigins(main.origins, chainId, 1)
      return main
    })
  }
}

export const selectPrimary = (u: UpdateFn, netType: string, netId: string, value: string) => {
  u('main.networks', netType, netId, 'connection.primary.current', () => value)
}

export const selectSecondary = (u: UpdateFn, netType: string, netId: string, value: string) => {
  u('main.networks', netType, netId, 'connection.secondary.current', () => value)
}

export const setPrimaryCustom = (u: UpdateFn, netType: string, netId: string, target: string) => {
  if (!netType || !netId) return
  u('main.networks', netType, netId, 'connection.primary.custom', () => target)
}

export const setSecondaryCustom = (u: UpdateFn, netType: string, netId: string, target: string) => {
  if (!netType || !netId) return
  u('main.networks', netType, netId, 'connection.secondary.custom', () => target)
}

export const toggleConnection = (u: UpdateFn, netType: string, netId: string, node: string, on?: boolean) => {
  u('main.networks', netType, netId, 'connection', node, 'on', (value: boolean) => {
    return on !== undefined ? on : !value
  })
}

export const setPrimary = (u: UpdateFn, netType: string, netId: string, status: any) => {
  u('main.networks', netType, netId, 'connection.primary', (primary: any) => {
    return Object.assign({}, primary, status)
  })
}

export const setSecondary = (u: UpdateFn, netType: string, netId: string, status: any) => {
  u('main.networks', netType, netId, 'connection.secondary', (secondary: any) => {
    return Object.assign({}, secondary, status)
  })
}

export const setLaunch = (u: UpdateFn, launch: boolean) => u('main.launch', () => launch)
export const toggleLaunch = (u: UpdateFn) => u('main.launch', (launch: boolean) => !launch)
export const toggleReveal = (u: UpdateFn) => u('main.reveal', (reveal: boolean) => !reveal)
export const toggleShowLocalNameWithENS = (u: UpdateFn) =>
  u('main.showLocalNameWithENS', (v: boolean) => !v)

export const setPermission = (u: UpdateFn, address: string, permission: any) => {
  u('main.permissions', address, (permissions: any = {}) => {
    permissions[permission.handlerId] = permission
    return permissions
  })
}

export const clearPermissions = (u: UpdateFn, address: string) => {
  u('main.permissions', address, () => ({}))
}

export const toggleAccess = (u: UpdateFn, address: string, handlerId: string) => {
  u('main.permissions', address, (permissions: any) => {
    permissions[handlerId].provider = !permissions[handlerId].provider
    return permissions
  })
}

export const setAccountCloseLock = (u: UpdateFn, value: any) => {
  u('main.accountCloseLock', () => Boolean(value))
}

export const syncPath = (u: UpdateFn, path: string, value: any) => {
  if (!path || path === '*' || path.startsWith('main')) return
  u(path, () => value)
}

export const dontRemind = (u: UpdateFn, version: string) => {
  u('main.updater.dontRemind', (dontRemind: string[]) => {
    if (!dontRemind.includes(version)) {
      return [...dontRemind, version]
    }
    return dontRemind
  })
}

export const setAccount = (u: UpdateFn, account: { id: string }) => {
  u('selected.current', () => account.id)
  u('selected.minimized', () => false)
  u('selected.open', () => true)
}

export const setAccountSignerStatusOpen = (u: UpdateFn, value: any) => {
  u('selected.signerStatusOpen', () => Boolean(value))
}

export const accountTokensUpdated = (u: UpdateFn, address: string) => {
  u('main.accounts', address, (account: any) => {
    const balances = { ...account.balances, lastUpdated: new Date().getTime() }
    return { ...account, balances }
  })
}

export const updateAccount = (u: UpdateFn, updatedAccount: any) => {
  const { id, name } = updatedAccount
  u('main.accounts', id, (account: any = {}) => {
    return { ...updatedAccount, balances: account.balances || {} }
  })
  if (name && !isDefaultAccountName({ ...updatedAccount, name })) {
    const accountMetaId = uuidv5(id, accountNS)
    u('main.accountsMeta', accountMetaId, (accountMeta: any) => {
      return { ...accountMeta, name, lastUpdated: Date.now() }
    })
  }
}

export const removeAccount = (u: UpdateFn, id: string) => {
  u('main.accounts', (accounts: any) => {
    delete accounts[id]
    return accounts
  })
}

export const removeSigner = (u: UpdateFn, id: string) => {
  u('main.signers', (signers: any) => {
    delete signers[id]
    return signers
  })
}

export const updateSigner = (u: UpdateFn, signer: any) => {
  if (!signer.id) return
  u('main.signers', signer.id, (prev: any) => ({ ...prev, ...signer }))
}

export const newSigner = (u: UpdateFn, signer: any) => {
  u('main.signers', (signers: any) => {
    signers[signer.id] = { ...signer, createdAt: new Date().getTime() }
    return signers
  })
}

export const setLatticeConfig = (u: UpdateFn, id: string, key: string, value: any) => {
  u('main.lattice', id, key, () => value)
}

export const updateLattice = (u: UpdateFn, deviceId: string, update: any) => {
  if (deviceId && update) u('main.lattice', deviceId, (current: any = {}) => Object.assign(current, update))
}

export const removeLattice = (u: UpdateFn, deviceId: string) => {
  if (deviceId) {
    u('main.lattice', (lattice: any = {}) => {
      delete lattice[deviceId]
      return lattice
    })
  }
}

export const setLatticeAccountLimit = (u: UpdateFn, limit: number) => {
  u('main.latticeSettings.accountLimit', () => limit)
}

export const setLatticeEndpointMode = (u: UpdateFn, mode: string) => {
  u('main.latticeSettings.endpointMode', () => mode)
}

export const setLatticeEndpointCustom = (u: UpdateFn, url: string) => {
  u('main.latticeSettings.endpointCustom', () => url)
}

export const setLatticeDerivation = (u: UpdateFn, value: string) => {
  u('main.latticeSettings.derivation', () => value)
}

export const setLedgerDerivation = (u: UpdateFn, value: string) => {
  u('main.ledger.derivation', () => value)
}

export const setTrezorDerivation = (u: UpdateFn, value: string) => {
  u('main.trezor.derivation', () => value)
}

export const setLiveAccountLimit = (u: UpdateFn, value: number) => {
  u('main.ledger.liveAccountLimit', () => value)
}

export const setMenubarGasPrice = (u: UpdateFn, value: boolean) => {
  u('main.menubarGasPrice', () => value)
}

export const muteAlphaWarning = (u: UpdateFn) => {
  u('main.mute.alphaWarning', () => true)
}

export const muteWelcomeWarning = (u: UpdateFn) => {
  u('main.mute.welcomeWarning', () => true)
}

export const toggleExplorerWarning = (u: UpdateFn) => {
  u('main.mute.explorerWarning', (v: boolean) => !v)
}

export const toggleGasFeeWarning = (u: UpdateFn) => {
  u('main.mute.gasFeeWarning', (v: boolean) => !v)
}

export const toggleSignerCompatibilityWarning = (u: UpdateFn) => {
  u('main.mute.signerCompatibilityWarning', (v: boolean) => !v)
}

export const setShortcut = (u: UpdateFn, name: string, shortcut: any) => {
  u('main.shortcuts', name, (existingShortcut: any = {}) => ({
    modifierKeys: shortcut.modifierKeys || existingShortcut.modifierKeys,
    shortcutKey: shortcut.shortcutKey || existingShortcut.shortcutKey,
    configuring: shortcut.configuring ?? existingShortcut.configuring,
    enabled: shortcut.enabled ?? existingShortcut.enabled
  }))
}

export const setKeyboardLayout = (u: UpdateFn, layout: any) => {
  u('keyboardLayout', (existingLayout: any = {}) => ({
    isUS: layout.isUS ?? existingLayout.isUS
  }))
}

export const setAutohide = (u: UpdateFn, v: boolean) => {
  u('main.autohide', () => v)
}

export const setErrorReporting = (u: UpdateFn, enable: boolean) => {
  u('main.privacy.errorReporting', () => enable)
}

export const setGasFees = (u: UpdateFn, netType: string, netId: string, fees: any) => {
  u('main.networksMeta', netType, netId, 'gas.price.fees', () => fees)
}

export const setGasPrices = (u: UpdateFn, netType: string, netId: string, prices: any) => {
  u('main.networksMeta', netType, netId, 'gas.price.levels', () => prices)
}

export const setGasDefault = (u: UpdateFn, netType: string, netId: string, level: string, price?: string) => {
  u('main.networksMeta', netType, netId, 'gas.price.selected', () => level)
  if (level === 'custom') {
    u('main.networksMeta', netType, netId, 'gas.price.levels.custom', () => price)
  } else {
    u('main.networksMeta', netType, netId, 'gas.price.lastLevel', () => level)
  }
}

export const addSampleGasCosts = (u: UpdateFn, netType: string, netId: string, samples: any[]) => {
  u('main.networksMeta', netType, netId, 'gas.samples', () => samples)
}

export const setNativeCurrencyData = (u: UpdateFn, netType: string, netId: string, currency: any) => {
  u('main.networksMeta', netType, netId, 'nativeCurrency', (existing: any) => ({ ...existing, ...currency }))
}

export const addNetwork = (u: UpdateFn, net: any) => {
  try {
    net.id = validateNetworkSettings(net)

    const primaryRpc = net.primaryRpc || ''
    const secondaryRpc = net.secondaryRpc || ''
    delete net.primaryRpc
    delete net.secondaryRpc

    const defaultNetwork = {
      id: 0,
      isTestnet: false,
      type: '',
      name: '',
      explorer: '',
      gas: {
        price: {
          selected: 'standard',
          levels: { slow: '', standard: '', fast: '', asap: '', custom: '' }
        }
      },
      connection: {
        presets: { local: 'direct' },
        primary: {
          on: true,
          current: 'custom',
          status: 'loading',
          connected: false,
          type: '',
          network: '',
          custom: primaryRpc
        },
        secondary: {
          on: false,
          current: 'custom',
          status: 'loading',
          connected: false,
          type: '',
          network: '',
          custom: secondaryRpc
        }
      },
      on: true
    }

    const defaultMeta = {
      blockHeight: 0,
      name: net.name,
      primaryColor: net.primaryColor,
      icon: net.icon || '',
      nativeCurrency: {
        symbol: net.symbol,
        icon: net.nativeCurrencyIcon || '',
        name: net.nativeCurrencyName || '',
        decimals: 18
      },
      gas: {
        price: {
          selected: 'standard',
          levels: { slow: '', standard: '', fast: '', asap: '', custom: '' }
        }
      }
    }

    u('main', (main: any) => {
      if (!main.networks[net.type]) main.networks[net.type] = {}
      if (main.networks[net.type][net.id]) return main

      main.networks[net.type][net.id] = { ...defaultNetwork, ...net }
      main.networksMeta[net.type][net.id] = { ...defaultMeta }

      return main
    })
  } catch (e) {
    log.error(e)
  }
}

export const updateNetwork = (u: UpdateFn, net: any, newNet: any) => {
  try {
    net.id = validateNetworkSettings(net)
    newNet.id = validateNetworkSettings(newNet)

    u('main', (main: any) => {
      const update = Object.assign({}, main.networks[net.type][net.id], newNet)

      Object.keys(update).forEach((k) => {
        if (typeof update[k] === 'string') {
          update[k] = update[k].trim()
        }
      })

      const { nativeCurrencyName, nativeCurrencyIcon, icon, ...updatedNetwork } = update

      delete main.networks[net.type][net.id]
      main.networks[updatedNetwork.type][updatedNetwork.id] = updatedNetwork

      Object.entries(main.origins).forEach(([origin, { chain }]: [string, any]) => {
        if (net.id === chain.id) {
          main.origins[origin].chain = updatedNetwork
        }
      })

      const existingNetworkMeta = main.networksMeta[updatedNetwork.type][updatedNetwork.id] || {}
      const networkCurrency = existingNetworkMeta.nativeCurrency || {}

      main.networksMeta[updatedNetwork.type][updatedNetwork.id] = {
        ...existingNetworkMeta,
        symbol: update.symbol,
        icon,
        nativeCurrency: {
          ...networkCurrency,
          symbol: update.symbol,
          name: nativeCurrencyName,
          icon: nativeCurrencyIcon
        }
      }

      return main
    })
  } catch (e) {
    log.error(e)
  }
}

export const removeNetwork = (u: UpdateFn, net: any) => {
  try {
    net.id = parseInt(net.id)

    if (!Number.isInteger(net.id)) throw new Error('Invalid chain id')
    if (net.type === 'ethereum' && net.id === 1) throw new Error('Cannot remove mainnet')
    u('main', (main: any) => {
      if (Object.keys(main.networks[net.type]).length <= 1) {
        return main
      }

      switchChainForOrigins(main.origins, net.id, 1)

      if (main.networks[net.type]) {
        delete main.networks[net.type][net.id]
        delete main.networksMeta[net.type][net.id]
      }

      return main
    })
  } catch (e) {
    log.error(e)
  }
}

export const initOrigin = (u: UpdateFn, originId: string, origin: any) => {
  u('main.origins', (origins: any) => {
    const now = new Date().getTime()

    const createdOrigin = {
      ...origin,
      session: {
        requests: 1,
        startedAt: now,
        lastUpdatedAt: now
      }
    }

    return { ...origins, [originId]: createdOrigin }
  })
}

export const addOriginRequest = (u: UpdateFn, originId: string) => {
  const now = new Date().getTime()

  u('main.origins', originId, (origin: any) => {
    const isNewSession = origin.session.startedAt < origin.session.endedAt
    const startedAt = isNewSession ? now : origin.session.startedAt
    const requests = isNewSession ? 1 : origin.session.requests + 1

    return {
      ...origin,
      session: {
        requests,
        startedAt,
        endedAt: undefined,
        lastUpdatedAt: now
      }
    }
  })
}

export const endOriginSession = (u: UpdateFn, originId: string) => {
  u('main.origins', (origins: any) => {
    const origin = origins[originId]
    if (origin) {
      const now = new Date().getTime()
      const session = Object.assign({}, origin.session, { endedAt: now, lastUpdatedAt: now })
      origins[originId] = Object.assign({}, origin, { session })
    }
    return origins
  })
}

export const switchOriginChain = (u: UpdateFn, originId: string, chainId: number, type: string) => {
  if (originId && typeof chainId === 'number' && type === 'ethereum') {
    u('main.origins', originId, (origin: any) => ({ ...origin, chain: { id: chainId, type } }))
  }
}

export const clearOrigins = (u: UpdateFn) => {
  u('main.origins', () => ({}))
}

export const removeOrigin = (u: UpdateFn, originId: string) => {
  u('main.origins', (origins: any) => {
    delete origins[originId]
    return origins
  })
}

export const trustExtension = (u: UpdateFn, extensionId: string, trusted: boolean) => {
  u('main.knownExtensions', (extensions: any = {}) => ({ ...extensions, [extensionId]: trusted }))
}

export const setBlockHeight = (u: UpdateFn, chainId: string | number, blockHeight: number) => {
  u('main.networksMeta.ethereum', (chainsMeta: any) => {
    if (chainsMeta[chainId]) {
      chainsMeta[chainId] = { ...chainsMeta[chainId], blockHeight }
    } else {
      log.error(`Action Error: setBlockHeight chainId: ${chainId} not found in chainsMeta`)
    }
    return chainsMeta
  })
}

export const setChainColor = (u: UpdateFn, chainId: string | number, color: string) => {
  u('main.networksMeta.ethereum', (chainsMeta: any) => {
    if (chainsMeta[chainId]) {
      chainsMeta[chainId] = { ...chainsMeta[chainId], primaryColor: color }
    } else {
      log.error(`Action Error: setChainColor chainId: ${chainId} not found in chainsMeta`)
    }
    return chainsMeta
  })
}

export const expandDock = (u: UpdateFn, expand: boolean) => {
  u('dock.expand', () => expand)
}

export const pin = (u: UpdateFn) => {
  u('main.pin', (pinState: boolean) => !pinState)
}

export const saveAccount = (u: UpdateFn, id: string) => {
  u('main.save.account', () => id)
}

export const setIPFS = (u: UpdateFn, ipfs: any) => {
  u('main.ipfs', () => ipfs)
}

export const setRates = (u: UpdateFn, rates: any) => {
  u('main.rates', (existingRates: any = {}) => ({ ...existingRates, ...rates }))
}

export const setInventory = (u: UpdateFn, address: string, inventory: any) => {
  u('main.inventory', address, () => inventory)
}

export const setBalance = (u: UpdateFn, address: string, balance: any) => {
  u('main.balances', address, (balances: any[] = []) => {
    const existingBalances = balances.filter(
      (b) => b.address !== balance.address || b.chainId !== balance.chainId
    )
    return [...existingBalances, balance]
  })
}

export const setBalances = (u: UpdateFn, address: string, newBalances: any[]) => {
  u('main.balances', address, (balances: any[] = []) => {
    const existingBalances = balances.filter((b) => {
      return newBalances.every((bal) => bal.chainId !== b.chainId || bal.address !== b.address)
    })
    return [...existingBalances, ...newBalances]
  })
}

export const removeBalance = (u: UpdateFn, chainId: number, address: string) => {
  u('main.balances', (balances: any = {}) => {
    const key = address.toLowerCase()

    for (const accountAddress in balances) {
      const balanceIndex = balances[accountAddress].findIndex(
        (balance: any) => balance.chainId === chainId && balance.address.toLowerCase() === key
      )

      if (balanceIndex > -1) {
        balances[accountAddress].splice(balanceIndex, 1)
      }
    }

    return balances
  })
}

export const removeBalances = (u: UpdateFn, address: string, tokensToRemove: Set<string>) => {
  const needsRemoval = (balance: any) => tokensToRemove.has(toTokenId(balance))
  u('main.balances', address, (balances: any[] = []) => balances.filter((balance) => !needsRemoval(balance)))
}

export const setScanning = (u: UpdateFn, address: string, scanning: boolean) => {
  if (scanning) {
    u('main.scanning', address, () => true)
  } else {
    setTimeout(() => {
      u('main.scanning', address, () => false)
    }, 1000)
  }
}

export const omitToken = (u: UpdateFn, address: string, omitTokenId: string) => {
  u('main.accounts', address, 'tokens.omit', (omit: string[]) => {
    omit = omit || []
    if (omit.indexOf(omitTokenId) === -1) omit.push(omitTokenId)
    return omit
  })
}

export const addCustomTokens = (u: UpdateFn, tokens: any[]) => {
  u('main.tokens.custom', (existing: any[]) => {
    const existingTokens = existing.filter((token) => !includesToken(tokens, token))
    const tokensToAdd = tokens.map((t) => ({ ...t, address: t.address.toLowerCase() }))
    return [...existingTokens, ...tokensToAdd]
  })

  u('main.balances', (balances: any) => {
    Object.values(balances).forEach((accountBalances: any) => {
      tokens.forEach((token) => {
        const tokenAddress = token.address.toLowerCase()
        const matchingBalance = accountBalances.find(
          (b: any) => b.address.toLowerCase() === tokenAddress && b.chainId === token.chainId
        )

        if (matchingBalance) {
          matchingBalance.logoURI = token.logoURI || matchingBalance.logoURI
          matchingBalance.symbol = token.symbol || matchingBalance.symbol
          matchingBalance.name = token.name || matchingBalance.symbol
        }
      })
    })

    return balances
  })
}

export const removeCustomTokens = (u: UpdateFn, tokens: any[]) => {
  const tokenIds = new Set(tokens.map(toTokenId))
  const needsRemoval = (token: any) => tokenIds.has(toTokenId(token))

  u('main.tokens.custom', (existing: any[]) => {
    return existing.filter((token) => !needsRemoval(token))
  })

  u('main.tokens.known', (knownTokens: any) => {
    for (const address in knownTokens) {
      knownTokens[address] = knownTokens[address].filter((token: any) => !needsRemoval(token))
    }
    return knownTokens
  })
}

export const addKnownTokens = (u: UpdateFn, address: string, tokens: any[]) => {
  u('main.tokens.known', address, (existing: any[] = []) => {
    const existingTokens = existing.filter((token) => !includesToken(tokens, token))
    const tokensToAdd = tokens.map((t) => ({ ...t, address: t.address.toLowerCase() }))
    return [...existingTokens, ...tokensToAdd]
  })
}

export const removeKnownTokens = (u: UpdateFn, address: string, tokensToRemove: Set<string>) => {
  const needsRemoval = (token: any) => tokensToRemove.has(toTokenId(token))
  u('main.tokens.known', address, (existing: any[] = []) => existing.filter((token) => !needsRemoval(token)))
}

export const setColorway = (u: UpdateFn, colorway: string) => {
  u('main.colorway', () => colorway)
}

export const navForward = (u: UpdateFn, windowId: string, crumb: any) => {
  if (!windowId || !crumb) return log.warn('Invalid nav forward', windowId, crumb)
  u('windows', windowId, 'nav', (nav: any[]) => {
    if (JSON.stringify(nav[0]) !== JSON.stringify(crumb)) nav.unshift(crumb)
    return nav
  })
  u('windows', windowId, 'showing', () => true)
}

export const navUpdate = (u: UpdateFn, windowId: string, crumb: any, navigate?: boolean) => {
  if (!windowId || !crumb) return log.warn('Invalid nav forward', windowId, crumb)
  u('windows', windowId, 'nav', (nav: any[]) => {
    const updatedNavItem = {
      view: nav[0].view || crumb.view,
      data: Object.keys(crumb.data).length === 0 ? {} : Object.assign({}, nav[0].data, crumb.data)
    }
    if (JSON.stringify(nav[0]) !== JSON.stringify(updatedNavItem)) {
      if (navigate) {
        nav.unshift(updatedNavItem)
      } else {
        nav[0] = updatedNavItem
      }
    }
    return nav
  })
  if (navigate) u('windows', windowId, 'showing', () => true)
}

export const navReplace = (u: UpdateFn, windowId: string, crumbs: any[] = []) => {
  u('windows', windowId, (win: any) => {
    win.nav = crumbs
    win.showing = true
    return win
  })
}

export const navClearSigner = (u: UpdateFn, signerId: string) => {
  u('windows.dash.nav', (nav: any[]) => nav.filter((navItem) => navItem?.data?.signer !== signerId))
}

export const navClearReq = (u: UpdateFn, handlerId: string, showRequestInbox = true) => {
  u('windows.panel.nav', (nav: any[]) => {
    return nav.filter((navItem) => {
      const isClearedRequest = navItem?.data?.requestId === handlerId
      const isRequestInbox = navItem?.data?.id === 'requests' && navItem?.view === 'expandedModule'
      return !isClearedRequest && (showRequestInbox || !isRequestInbox)
    })
  })
}

export const navBack = (u: UpdateFn, windowId: string, numSteps = 1) => {
  if (!windowId) return log.warn('Invalid nav back', windowId)
  u('windows', windowId, 'nav', (nav: any[]) => {
    while (numSteps > 0 && nav.length > 0) {
      nav.shift()
      numSteps -= 1
    }
    return nav
  })
}

export const navDash = (u: UpdateFn, navItem: any) => {
  u('windows.dash.nav', (nav: any[]) => {
    if (JSON.stringify(nav[0]) !== JSON.stringify(navItem)) nav.unshift(navItem)
    return nav
  })
  u('windows.dash.showing', () => true)
}

export const muteBetaDisclosure = (u: UpdateFn) => {
  u('main.mute.betaDisclosure', () => true)
  const navItem = { view: 'accounts', data: {} }
  u('windows.dash.nav', (nav: any[]) => {
    if (JSON.stringify(nav[0]) !== JSON.stringify(navItem)) nav.unshift(navItem)
    return nav
  })
  u('windows.dash.showing', () => true)
}

export const mutePylonMigrationNotice = (u: UpdateFn) => {
  u('main.mute.migrateToPylon', () => true)
}

export const migrateToPylonConnections = (u: UpdateFn) => {
  const pylonChains = ['1', '5', '10', '137', '42161', '11155111']

  const switchToPylon = (connection: any = {}) => {
    if (connection.current === 'custom' && connection.custom === '') {
      connection.current = 'pylon'
    }
  }

  u('main.networks.ethereum', (chains: any) => {
    Object.entries(chains).forEach(([id, chain]: [string, any]) => {
      if (pylonChains.includes(id)) {
        const { primary, secondary } = chain.connection
        switchToPylon(primary)
        switchToPylon(secondary)
      }
    })
    return chains
  })
}

export const completeOnboarding = (u: UpdateFn) => {
  u('main.mute.onboardingWindow', () => true)
  u('windows.onboard.showing', () => false)
}

export const unsetAccount = (u: UpdateFn) => {
  u('selected.open', () => false)
  u('selected.minimized', () => true)
  u('selected.view', () => 'default')
  u('selected.showAccounts', () => false)
  u('windows.panel.nav', () => [])
  setTimeout(() => {
    u('selected', (signer: any) => {
      signer.last = signer.current
      signer.current = ''
      signer.requests = {}
      signer.view = 'default'
      return signer
    })
  }, 320)
}

export const setAccountFilter = (u: UpdateFn, value: string) => {
  u('panel.accountFilter', () => value)
}

export const setFooterHeight = (u: UpdateFn, win: string, height: number) => {
  u('windows', win, 'footer.height', () => (height < 40 ? 40 : height))
}

export const updateTypedDataRequest = (u: UpdateFn, account: string, reqId: string, data: any) => {
  u('main.accounts', account, 'requests', (requests: any) => {
    if (!requests[reqId]?.typedMessage?.data) {
      log.error('No typed data request found for ', { reqId })
      return requests
    }

    Object.assign(requests[reqId], data)

    return requests
  })
}

export const updateBadge = (u: UpdateFn, type: string, version?: string) => {
  u('main.updater.badge', () => type ? { type, version: version || '' } : null)
}
