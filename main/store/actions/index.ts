import log from 'electron-log'
import { v5 as uuidv5 } from 'uuid'
import { accountNS, isDefaultAccountName } from '../../../resources/domain/account'
import { toTokenId } from '../../../resources/domain/balance'
import state from '..'

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

function setByPath(obj: any, parts: string[], value: any) {
  for (let i = 0; i < parts.length - 1; i++) {
    if (obj[parts[i]] === undefined) obj[parts[i]] = {}
    obj = obj[parts[i]]
  }
  obj[parts[parts.length - 1]] = value
}

// ---- Networks ----

export function activateNetwork(type: string, chainId: number, active: boolean) {
  state.main.networks[type][chainId].on = active
  if (!active) {
    switchChainForOrigins(state.main.origins, chainId, 1)
  }
}

export function selectPrimary(netType: string, netId: string, value: string) {
  state.main.networks[netType][netId].connection.primary.current = value
}

export function selectSecondary(netType: string, netId: string, value: string) {
  state.main.networks[netType][netId].connection.secondary.current = value
}

export function setPrimaryCustom(netType: string, netId: string, target: string) {
  if (!netType || !netId) return
  state.main.networks[netType][netId].connection.primary.custom = target
}

export function setSecondaryCustom(netType: string, netId: string, target: string) {
  if (!netType || !netId) return
  state.main.networks[netType][netId].connection.secondary.custom = target
}

export function toggleConnection(netType: string, netId: string, node: string, on?: boolean) {
  const connection = state.main.networks[netType][netId].connection as any
  connection[node].on = on !== undefined ? on : !connection[node].on
}

export function setPrimary(netType: string, netId: string, status: any) {
  Object.assign(state.main.networks[netType][netId].connection.primary, status)
}

export function setSecondary(netType: string, netId: string, status: any) {
  Object.assign(state.main.networks[netType][netId].connection.secondary, status)
}

export function addNetwork(net: any) {
  try {
    net.id = validateNetworkSettings(net)

    const primaryRpc = net.primaryRpc || ''
    const secondaryRpc = net.secondaryRpc || ''
    delete net.primaryRpc
    delete net.secondaryRpc

    if (!state.main.networks[net.type]) (state.main.networks as any)[net.type] = {}
    if (state.main.networks[net.type][net.id]) return

    state.main.networks[net.type][net.id] = {
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
      on: true,
      ...net
    }
    ;(state.main.networksMeta as any)[net.type][net.id] = {
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
  } catch (e) {
    log.error(e)
  }
}

export function updateNetwork(net: any, newNet: any) {
  try {
    net.id = validateNetworkSettings(net)
    newNet.id = validateNetworkSettings(newNet)

    const update = { ...state.main.networks[net.type][net.id], ...newNet }

    Object.keys(update).forEach((k) => {
      if (typeof update[k] === 'string') update[k] = update[k].trim()
    })

    const { nativeCurrencyName, nativeCurrencyIcon, icon, ...updatedNetwork } = update

    delete state.main.networks[net.type][net.id]
    state.main.networks[updatedNetwork.type][updatedNetwork.id] = updatedNetwork

    Object.entries(state.main.origins).forEach(([origin, { chain }]: [string, any]) => {
      if (net.id === chain.id) {
        state.main.origins[origin].chain = updatedNetwork
      }
    })

    const existingNetworkMeta = (state.main.networksMeta as any)[updatedNetwork.type][updatedNetwork.id] || {}
    const networkCurrency = existingNetworkMeta.nativeCurrency || {}

    ;(state.main.networksMeta as any)[updatedNetwork.type][updatedNetwork.id] = {
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
  } catch (e) {
    log.error(e)
  }
}

export function removeNetwork(net: any) {
  try {
    net.id = parseInt(net.id)
    if (!Number.isInteger(net.id)) throw new Error('Invalid chain id')
    if (net.type === 'ethereum' && net.id === 1) throw new Error('Cannot remove mainnet')

    if (Object.keys(state.main.networks[net.type]).length <= 1) return

    switchChainForOrigins(state.main.origins, net.id, 1)

    if (state.main.networks[net.type]) {
      delete state.main.networks[net.type][net.id]
      delete (state.main.networksMeta as any)[net.type][net.id]
    }
  } catch (e) {
    log.error(e)
  }
}

export function setBlockHeight(chainId: string | number, blockHeight: number) {
  const chainsMeta = state.main.networksMeta.ethereum as any
  if (chainsMeta[chainId]) {
    chainsMeta[chainId].blockHeight = blockHeight
  } else {
    log.error(`Action Error: setBlockHeight chainId: ${chainId} not found in chainsMeta`)
  }
}

export function setChainColor(chainId: string | number, color: string) {
  const chainsMeta = state.main.networksMeta.ethereum as any
  if (chainsMeta[chainId]) {
    chainsMeta[chainId].primaryColor = color
  } else {
    log.error(`Action Error: setChainColor chainId: ${chainId} not found in chainsMeta`)
  }
}

// ---- Gas ----

export function setGasFees(netType: string, netId: string, fees: any) {
  ;(state.main.networksMeta as any)[netType][netId].gas.price.fees = fees
}

export function setGasPrices(netType: string, netId: string, prices: any) {
  ;(state.main.networksMeta as any)[netType][netId].gas.price.levels = prices
}

export function setGasDefault(netType: string, netId: string | number, level: string, price?: string) {
  ;(state.main.networksMeta as any)[netType][netId].gas.price.selected = level
  if (level === 'custom') {
    ;(state.main.networksMeta as any)[netType][netId].gas.price.levels.custom = price
  } else {
    ;(state.main.networksMeta as any)[netType][netId].gas.price.lastLevel = level
  }
}

export function addSampleGasCosts(netType: string, netId: string, samples: any[]) {
  ;(state.main.networksMeta as any)[netType][netId].gas.samples = samples
}

export function setNativeCurrencyData(netType: string, netId: string | number, currency: any) {
  const meta = (state.main.networksMeta as any)[netType][netId]
  Object.assign(meta.nativeCurrency, currency)
}

// ---- Accounts ----

export function setAccount(account: { id: string }) {
  ;(state as any).selected.current = account.id
  ;(state as any).selected.minimized = false
  ;(state as any).selected.open = true
}

export function setAccountSignerStatusOpen(value: any) {
  ;(state as any).selected.signerStatusOpen = Boolean(value)
}

export function accountTokensUpdated(address: string) {
  const account = state.main.accounts[address] as any
  if (account) {
    account.balances = { ...account.balances, lastUpdated: new Date().getTime() }
  }
}

export function updateAccount(updatedAccount: any) {
  const { id, name } = updatedAccount
  const existing = state.main.accounts[id] as any
  state.main.accounts[id] = { ...updatedAccount, balances: existing?.balances || {} }

  if (name && !isDefaultAccountName({ ...updatedAccount, name })) {
    const accountMetaId = uuidv5(id, accountNS)
    const existingMeta = state.main.accountsMeta[accountMetaId] || {}
    state.main.accountsMeta[accountMetaId] = { ...existingMeta, name, lastUpdated: Date.now() }
  }
}

export function removeAccount(id: string) {
  delete state.main.accounts[id]
}

export function setAccountCloseLock(value: any) {
  state.main.accountCloseLock = Boolean(value)
}

export function saveAccount(id: string) {
  ;(state.main as any).save = { account: id }
}

export function unsetAccount() {
  const selected = (state as any).selected
  selected.open = false
  selected.minimized = true
  selected.view = 'default'
  selected.showAccounts = false
  ;(state as any).windows.panel.nav = []
  setTimeout(() => {
    selected.last = selected.current
    selected.current = ''
    selected.requests = {}
    selected.view = 'default'
  }, 320)
}

export function setAccountFilter(value: string) {
  ;(state as any).panel.accountFilter = value
}

// ---- Signers ----

export function updateSigner(signer: any) {
  if (!signer.id) return
  const existing = state.main.signers[signer.id] || {}
  state.main.signers[signer.id] = { ...existing, ...signer }
}

export function newSigner(signer: any) {
  state.main.signers[signer.id] = { ...signer, createdAt: new Date().getTime() }
}

export function removeSigner(id: string) {
  delete state.main.signers[id]
}

// ---- Lattice & Hardware ----

export function setLatticeConfig(id: string, key: string, value: any) {
  if (!state.main.lattice[id]) (state.main.lattice as any)[id] = {}
  ;(state.main.lattice as any)[id][key] = value
}

export function updateLattice(deviceId: string, update: any) {
  if (!deviceId || !update) return
  if (!state.main.lattice[deviceId]) (state.main.lattice as any)[deviceId] = {}
  Object.assign(state.main.lattice[deviceId], update)
}

export function removeLattice(deviceId: string) {
  if (deviceId) delete state.main.lattice[deviceId]
}

export function setLatticeAccountLimit(limit: number) {
  state.main.latticeSettings.accountLimit = limit
}

export function setLatticeEndpointMode(mode: string) {
  state.main.latticeSettings.endpointMode = mode
}

export function setLatticeEndpointCustom(url: string) {
  state.main.latticeSettings.endpointCustom = url
}

export function setLatticeDerivation(value: string) {
  state.main.latticeSettings.derivation = value
}

export function setLedgerDerivation(value: string) {
  state.main.ledger.derivation = value
}

export function setTrezorDerivation(value: string) {
  state.main.trezor.derivation = value
}

export function setLiveAccountLimit(value: number) {
  state.main.ledger.liveAccountLimit = value
}

// ---- Tokens & Balances ----

export function setBalance(address: string, balance: any) {
  if (!state.main.balances[address]) (state.main.balances as any)[address] = []
  const balances = state.main.balances[address] as any[]
  const idx = balances.findIndex((b) => b.address === balance.address && b.chainId === balance.chainId)
  if (idx >= 0) {
    balances[idx] = balance
  } else {
    balances.push(balance)
  }
}

export function setBalances(address: string, newBalances: any[]) {
  if (!state.main.balances[address]) (state.main.balances as any)[address] = []
  const balances = state.main.balances[address] as any[]
  // Remove existing entries that will be replaced
  const filtered = balances.filter((b: any) =>
    newBalances.every((nb) => nb.chainId !== b.chainId || nb.address !== b.address)
  )
  ;(state.main.balances as any)[address] = [...filtered, ...newBalances]
}

export function removeBalance(chainId: number, address: string) {
  const key = address.toLowerCase()
  for (const accountAddress in state.main.balances) {
    const balances = state.main.balances[accountAddress] as any[]
    const idx = balances.findIndex((b: any) => b.chainId === chainId && b.address.toLowerCase() === key)
    if (idx > -1) balances.splice(idx, 1)
  }
}

export function removeBalances(address: string, tokensToRemove: Set<string>) {
  const needsRemoval = (balance: any) => tokensToRemove.has(toTokenId(balance))
  const balances = (state.main.balances[address] || []) as any[]
  ;(state.main.balances as any)[address] = balances.filter((b: any) => !needsRemoval(b))
}

export function setScanning(address: string, scanning: boolean) {
  if (scanning) {
    ;(state.main as any).scanning = (state.main as any).scanning || {}
    ;(state.main as any).scanning[address] = true
  } else {
    setTimeout(() => {
      if ((state.main as any).scanning) {
        ;(state.main as any).scanning[address] = false
      }
    }, 1000)
  }
}

export function omitToken(address: string, omitTokenId: string) {
  const account = state.main.accounts[address] as any
  if (!account) return
  if (!account.tokens) account.tokens = { omit: [] }
  if (!account.tokens.omit) account.tokens.omit = []
  if (!account.tokens.omit.includes(omitTokenId)) {
    account.tokens.omit.push(omitTokenId)
  }
}

export function addCustomTokens(tokens: any[]) {
  const existing = (state.main.tokens.custom || []) as any[]
  const filtered = existing.filter((t: any) => !includesToken(tokens, t))
  const toAdd = tokens.map((t) => ({ ...t, address: t.address.toLowerCase() }))
  ;(state.main.tokens as any).custom = [...filtered, ...toAdd]

  // Update logo/symbol on matching balances
  for (const accountBalances of Object.values(state.main.balances) as any[]) {
    for (const token of tokens) {
      const addr = token.address.toLowerCase()
      const match = accountBalances.find(
        (b: any) => b.address.toLowerCase() === addr && b.chainId === token.chainId
      )
      if (match) {
        match.logoURI = token.logoURI || match.logoURI
        match.symbol = token.symbol || match.symbol
        match.name = token.name || match.symbol
      }
    }
  }
}

export function removeCustomTokens(tokens: any[]) {
  const tokenIds = new Set(tokens.map(toTokenId))
  const needsRemoval = (t: any) => tokenIds.has(toTokenId(t))

  ;(state.main.tokens as any).custom = ((state.main.tokens.custom || []) as any[]).filter(
    (t: any) => !needsRemoval(t)
  )

  const known = state.main.tokens.known as any
  for (const address in known) {
    known[address] = known[address].filter((t: any) => !needsRemoval(t))
  }
}

export function addKnownTokens(address: string, tokens: any[]) {
  const known = state.main.tokens.known as any
  if (!known[address]) known[address] = []
  const existing = known[address] as any[]
  const filtered = existing.filter((t: any) => !includesToken(tokens, t))
  const toAdd = tokens.map((t) => ({ ...t, address: t.address.toLowerCase() }))
  known[address] = [...filtered, ...toAdd]
}

export function removeKnownTokens(address: string, tokensToRemove: Set<string>) {
  const known = state.main.tokens.known as any
  if (!known[address]) return
  const needsRemoval = (t: any) => tokensToRemove.has(toTokenId(t))
  known[address] = known[address].filter((t: any) => !needsRemoval(t))
}

export function setRates(rates: any) {
  Object.assign(state.main.rates, rates)
}

// ---- Origins & Permissions ----

export function initOrigin(originId: string, origin: any) {
  const now = new Date().getTime()
  state.main.origins[originId] = {
    ...origin,
    session: { requests: 1, startedAt: now, lastUpdatedAt: now }
  }
}

export function addOriginRequest(originId: string) {
  const now = new Date().getTime()
  const origin = state.main.origins[originId] as any
  if (!origin) return
  const isNewSession = origin.session.startedAt < origin.session.endedAt
  origin.session = {
    requests: isNewSession ? 1 : origin.session.requests + 1,
    startedAt: isNewSession ? now : origin.session.startedAt,
    endedAt: undefined,
    lastUpdatedAt: now
  }
}

export function endOriginSession(originId: string) {
  const origin = state.main.origins[originId] as any
  if (!origin) return
  const now = new Date().getTime()
  origin.session.endedAt = now
  origin.session.lastUpdatedAt = now
}

export function switchOriginChain(originId: string, chainId: number, type: string) {
  if (originId && typeof chainId === 'number' && type === 'ethereum') {
    ;(state.main.origins[originId] as any).chain = { id: chainId, type }
  }
}

export function clearOrigins() {
  ;(state.main as any).origins = {}
}

export function removeOrigin(originId: string) {
  delete state.main.origins[originId]
}

export function setPermission(address: string, permission: any) {
  if (!state.main.permissions[address]) (state.main.permissions as any)[address] = {}
  ;(state.main.permissions[address] as any)[permission.handlerId] = permission
}

export function clearPermissions(address: string) {
  ;(state.main.permissions as any)[address] = {}
}

export function toggleAccess(address: string, handlerId: string) {
  const perm = (state.main.permissions[address] as any)?.[handlerId]
  if (perm) perm.provider = !perm.provider
}

export function trustExtension(extensionId: string, trusted: boolean) {
  ;(state.main.knownExtensions as any)[extensionId] = trusted
}

// ---- Settings & Preferences ----

export function setLaunch(launch: boolean) {
  state.main.launch = launch
}

export function toggleLaunch() {
  state.main.launch = !state.main.launch
}

export function toggleReveal() {
  state.main.reveal = !state.main.reveal
}

export function toggleShowLocalNameWithENS() {
  state.main.showLocalNameWithENS = !state.main.showLocalNameWithENS
}

export function setAutohide(v: boolean) {
  state.main.autohide = v
}

export function setErrorReporting(enable: boolean) {
  state.main.privacy.errorReporting = enable
}

export function setMenubarGasPrice(value: boolean) {
  state.main.menubarGasPrice = value
}

export function setColorway(colorway: string) {
  ;(state.main as any).colorway = colorway
}

export function setIPFS(ipfs: any) {
  ;(state.main as any).ipfs = ipfs
}

export function pin() {
  ;(state.main as any).pin = !(state.main as any).pin
}

export function setShortcut(name: string, shortcut: any) {
  const existing = (state.main.shortcuts as any)[name] || {}
  ;(state.main.shortcuts as any)[name] = {
    modifierKeys: shortcut.modifierKeys || existing.modifierKeys,
    shortcutKey: shortcut.shortcutKey || existing.shortcutKey,
    configuring: shortcut.configuring ?? existing.configuring,
    enabled: shortcut.enabled ?? existing.enabled
  }
}

export function setKeyboardLayout(layout: any) {
  const existing = (state as any).keyboardLayout || {}
  ;(state as any).keyboardLayout = { isUS: layout.isUS ?? existing.isUS }
}

export function syncPath(path: string, value: any) {
  if (!path || path === '*' || path.startsWith('main')) return
  setByPath(state, path.split('.'), value)
}

export function dontRemind(version: string) {
  if (!state.main.updater.dontRemind.includes(version)) {
    state.main.updater.dontRemind.push(version)
  }
}

export function updateBadge(type: string, version?: string) {
  ;(state.main.updater as any).badge = type ? { type, version: version || '' } : null
}

// ---- Mute Flags ----

export function muteAlphaWarning() {
  state.main.mute.alphaWarning = true
}

export function muteWelcomeWarning() {
  state.main.mute.welcomeWarning = true
}

export function toggleExplorerWarning() {
  state.main.mute.explorerWarning = !state.main.mute.explorerWarning
}

export function toggleGasFeeWarning() {
  state.main.mute.gasFeeWarning = !state.main.mute.gasFeeWarning
}

export function toggleSignerCompatibilityWarning() {
  state.main.mute.signerCompatibilityWarning = !state.main.mute.signerCompatibilityWarning
}

export function muteBetaDisclosure() {
  state.main.mute.betaDisclosure = true
  navDash({ view: 'accounts', data: {} })
}

export function completeOnboarding() {
  state.main.mute.onboardingWindow = true
  ;(state as any).windows.onboard = (state as any).windows.onboard || {}
  ;(state as any).windows.onboard.showing = false
}

// ---- Navigation ----

export function navForward(windowId: string, crumb: any) {
  if (!windowId || !crumb) return log.warn('Invalid nav forward', windowId, crumb)
  const nav = (state as any).windows[windowId].nav as any[]
  if (JSON.stringify(nav[0]) !== JSON.stringify(crumb)) nav.unshift(crumb)
  ;(state as any).windows[windowId].showing = true
}

export function navUpdate(windowId: string, crumb: any, navigate?: boolean) {
  if (!windowId || !crumb) return log.warn('Invalid nav forward', windowId, crumb)
  const nav = (state as any).windows[windowId].nav as any[]
  const updatedNavItem = {
    view: nav[0]?.view || crumb.view,
    data: Object.keys(crumb.data).length === 0 ? {} : { ...nav[0]?.data, ...crumb.data }
  }
  if (JSON.stringify(nav[0]) !== JSON.stringify(updatedNavItem)) {
    if (navigate) {
      nav.unshift(updatedNavItem)
    } else {
      nav[0] = updatedNavItem
    }
  }
  if (navigate) (state as any).windows[windowId].showing = true
}

export function navReplace(windowId: string, crumbs: any[] = []) {
  ;(state as any).windows[windowId].nav = crumbs
  ;(state as any).windows[windowId].showing = true
}

export function navClearSigner(signerId: string) {
  const nav = (state as any).windows.dash.nav as any[]
  ;(state as any).windows.dash.nav = nav.filter((item: any) => item?.data?.signer !== signerId)
}

export function navClearReq(handlerId: string, showRequestInbox = true) {
  const nav = (state as any).windows.panel.nav as any[]
  ;(state as any).windows.panel.nav = nav.filter((item: any) => {
    const isClearedRequest = item?.data?.requestId === handlerId
    const isRequestInbox = item?.data?.id === 'requests' && item?.view === 'expandedModule'
    return !isClearedRequest && (showRequestInbox || !isRequestInbox)
  })
}

export function navBack(windowId: string, numSteps = 1) {
  if (!windowId) return log.warn('Invalid nav back', windowId)
  const nav = (state as any).windows[windowId].nav as any[]
  let steps = numSteps
  while (steps > 0 && nav.length > 0) {
    nav.shift()
    steps -= 1
  }
}

export function navDash(navItem: any) {
  const nav = (state as any).windows.dash.nav as any[]
  if (JSON.stringify(nav[0]) !== JSON.stringify(navItem)) nav.unshift(navItem)
  ;(state as any).windows.dash.showing = true
}

// ---- Window & UI State ----

export function expandDock(expand: boolean) {
  ;(state as any).dock = (state as any).dock || {}
  ;(state as any).dock.expand = expand
}

export function setFooterHeight(win: string, height: number) {
  ;(state as any).windows[win].footer.height = height < 40 ? 40 : height
}

// ---- Requests ----

export function updateTypedDataRequest(account: string, reqId: string, data: any) {
  const requests = (state.main.accounts[account] as any)?.requests
  if (!requests?.[reqId]?.typedMessage?.data) {
    log.error('No typed data request found for ', { reqId })
    return
  }
  Object.assign(requests[reqId], data)
}

// ---- RPC Health ----

export function setRpcHealth(
  chainId: string | number,
  healthData: {
    latencyMs: number
    lastChecked: number
    status: 'healthy' | 'degraded' | 'down'
    consecutiveErrors: number
  }
) {
  const chainsMeta = state.main.networksMeta.ethereum as any
  if (chainsMeta[chainId]) {
    chainsMeta[chainId].rpcHealth = healthData
  }
}
