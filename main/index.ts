import { app, ipcMain, protocol, net, clipboard, powerMonitor } from 'electron'
import path from 'path'
import log from 'electron-log'
import url from 'url'
import { subscribe, snapshot } from 'valtio'

// DO NOT MOVE - env var below is required for app init and must be set before all local imports
process.env.BUNDLE_LOCATION = process.env.BUNDLE_LOCATION || path.resolve(__dirname, './../..', 'bundle')

import * as errors from './errors'
import windows from './windows'
import menu from './menu'
import state from './store'
import * as actions from './store/actions'
import accounts from './accounts'
import * as launch from './launch'
import updater from './updater'
import signers from './signers'
import persist from './store/persist'
import { showUnhandledExceptionDialog } from './windows/dialog'
import { openBlockExplorer, openExternal } from './windows/window'
import Erc20Contract from './contracts/erc20'
import { getChainlist } from './chainlist'
import { getErrorCode } from '../resources/utils'
import { startApi } from './api'
import './rpc'

app.commandLine.appendSwitch('enable-gpu-rasterization', 'true')
app.commandLine.appendSwitch('force-gpu-rasterization', 'true')
app.commandLine.appendSwitch('ignore-gpu-blocklist', 'true')
app.commandLine.appendSwitch('force-color-profile', 'srgb')

const isDev = process.env.NODE_ENV === 'development'
log.transports.console.level = process.env.LOG_LEVEL || (isDev ? 'verbose' : 'info')

if (process.env.LOG_LEVEL === 'debug') {
  log.transports.file.level = 'debug'
  log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/debug.log')
} else {
  log.transports.file.level = ['development', 'test'].includes(process.env.NODE_ENV) ? false : 'verbose'
}

const hasInstanceLock = app.requestSingleInstanceLock()

if (!hasInstanceLock) {
  log.info('another instance of Frame is running - exiting...')
  app.exit(1)
}
errors.init()

log.info(`Chrome: v${process.versions.chrome}`)
log.info(`Electron: v${process.versions.electron}`)
log.info(`Node: v${process.versions.node}`)

// prevent showing the exit dialog more than once
let closing = false

process.on('uncaughtException', (e) => {
  log.error('Uncaught Exception!', e)

  const errorCode = getErrorCode(e) ?? ''

  if (errorCode === 'EPIPE') {
    log.error('uncaught EPIPE error', e)
    return
  }

  if (!closing) {
    closing = true

    showUnhandledExceptionDialog(e.message, errorCode)
  }
})

process.on('unhandledRejection', (e) => {
  log.error('Unhandled Rejection!', e)
})

function startUpdater() {
  powerMonitor.on('resume', () => {
    log.debug('System resuming, starting updater')

    updater.start()
  })

  powerMonitor.on('suspend', () => {
    log.debug('System suspending, stopping updater')

    updater.stop()
  })

  updater.start()
}

global.eval = () => {
  throw new Error(`This app does not support global.eval()`)
} // eslint-disable-line

ipcMain.on('tray:resetAllSettings', () => {
  persist.clear()

  if (updater.updateReady) {
    return updater.quitAndInstall()
  }

  app.relaunch()
  app.exit(0)
})

ipcMain.on('tray:replaceTx', async (e, id, type) => {
  actions.navBack('panel')
  setTimeout(async () => {
    try {
      await accounts.replaceTx(id, type)
    } catch (e) {
      log.error('tray:replaceTx Error', e)
    }
  }, 1000)
})

ipcMain.on('tray:clipboardData', (e, data) => {
  if (data) clipboard.writeText(data)
})

ipcMain.on('tray:installAvailableUpdate', () => {
  actions.updateBadge('')

  updater.fetchUpdate()
})

ipcMain.on('tray:dismissUpdate', (e, version, remind) => {
  if (!remind) {
    actions.dontRemind(version)
  }

  actions.updateBadge('')

  updater.dismissUpdate()
})

ipcMain.on('tray:removeAccount', (e, id) => {
  accounts.remove(id)
})

ipcMain.on('tray:renameAccount', (e, id, name) => {
  accounts.rename(id, name)
})

ipcMain.on('dash:removeSigner', (e, id) => {
  signers.remove(id)
})

ipcMain.on('dash:reloadSigner', (e, id) => {
  signers.reload(id)
})

ipcMain.on('tray:resolveRequest', (e, req, result) => {
  accounts.resolveRequest(req, result)
})

ipcMain.on('tray:rejectRequest', (e, req) => {
  const err = { code: 4001, message: 'User rejected the request' }
  accounts.rejectRequest(req, err)
})

ipcMain.on('tray:clearRequestsByOrigin', (e, account, origin) => {
  accounts.clearRequestsByOrigin(account, origin)
})

ipcMain.on('tray:openExternal', (e, url) => {
  openExternal(url)
})

ipcMain.on('tray:openExplorer', (e, chain, hash, account) => {
  openBlockExplorer(chain, hash, account)
})

ipcMain.on('tray:copyTxHash', (e, hash) => {
  if (hash) clipboard.writeText(hash)
})

ipcMain.on('tray:giveAccess', (e, req, access) => {
  accounts.setAccess(req, access)
})

ipcMain.on('tray:addChain', (e, chain) => {
  actions.addNetwork(chain)
})

ipcMain.on('tray:switchChain', (e, type, id, req) => {
  // selectNetwork was never a real action — just resolve the request
  accounts.resolveRequest(req)
})

ipcMain.handle('tray:fetchChainlist', async () => {
  try {
    return await getChainlist()
  } catch (e) {
    log.warn('Could not fetch chainlist', e)
    return []
  }
})

ipcMain.handle('tray:getTokenDetails', async (e, contractAddress, chainId) => {
  try {
    const contract = new Erc20Contract(contractAddress, chainId)
    return await contract.getTokenData()
  } catch (e) {
    log.warn('Could not load token data for contract', { contractAddress, chainId })
    return {}
  }
})

ipcMain.on('tray:addToken', (e, token, req) => {
  if (token) {
    log.info('adding custom token', token)
    actions.addCustomTokens([token])
  }
  if (req) accounts.resolveRequest(req)
})

ipcMain.on('tray:removeToken', (e, token) => {
  if (token) {
    log.info('removing custom token', token)

    actions.removeBalance(token.chainId, token.address)
    actions.removeCustomTokens([token])
  }
})

ipcMain.on('tray:adjustNonce', (e, handlerId, nonceAdjust) => {
  accounts.adjustNonce(handlerId, nonceAdjust)
})

ipcMain.on('tray:resetNonce', (e, handlerId) => {
  accounts.resetNonce(handlerId)
})

ipcMain.on('tray:removeOrigin', (e, handlerId) => {
  accounts.removeRequests(handlerId)
  actions.removeOrigin(handlerId)
})

ipcMain.on('tray:clearOrigins', () => {
  Object.keys(state.main.origins).forEach((handlerId) => {
    accounts.removeRequests(handlerId)
  })
  actions.clearOrigins()
})

ipcMain.on('tray:syncPath', (e, path, value) => {
  actions.syncPath(path, value)
})

ipcMain.on('tray:ready', () => {
  startApi()

  if (!isDev) {
    startUpdater()
  }
})

ipcMain.on('tray:updateRestart', () => {
  updater.quitAndInstall()
})

ipcMain.on('frame:close', (e) => {
  windows.close(e)
})

ipcMain.on('frame:min', (e) => {
  windows.min(e)
})

ipcMain.on('frame:max', (e) => {
  windows.max(e)
})

ipcMain.on('frame:unmax', (e) => {
  windows.unmax(e)
})

app.on('ready', () => {
  menu()
  windows.init()
  if (isDev) {
    const loadDev = async () => {
      const { installDevTools, startCpuMonitoring } = await import('./dev')
      installDevTools()
      startCpuMonitoring()
    }

    void loadDev()
  }

  protocol.handle('file', (req) => {
    const appOrigin = path.resolve(__dirname, '../../')
    const filePath = url.fileURLToPath(req.url)

    if (filePath.startsWith(appOrigin)) {
      return net.fetch(url.pathToFileURL(filePath).toString())
    }

    return new Response('Forbidden', { status: 403 })
  })
})

// Dynamic action dispatch from renderer
ipcMain.on('tray:action', (e, action, ...args) => {
  const fn = (actions as any)[action]
  if (fn) return fn(...args)
  log.info('Tray sent unrecognized action: ', action)
})

app.on('second-instance', (event, argv, workingDirectory) => {
  log.info(`second instance requested from directory: ${workingDirectory}`)
  windows.showWindow()
})
app.on('activate', () => windows.showWindow())

app.on('before-quit', () => {
  if (!updater.updateReady) {
    updater.stop()
  }
})

app.on('will-quit', () => app.quit())
app.on('quit', () => {
  log.info('Application closing')

  // await clients.stop()
  accounts.close()
  signers.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let launchStatus = state.main.launch

subscribe(state, () => {
  if (launchStatus !== state.main.launch) {
    launchStatus = state.main.launch
    launchStatus ? launch.enable() : launch.disable()
  }
})
