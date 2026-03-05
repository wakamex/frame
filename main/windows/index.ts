import {
  app as electronApp,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  IpcMainEvent,
  WebContents
} from 'electron'
import path from 'path'
import log from 'electron-log'
import { subscribe, snapshot } from 'valtio'

import state from '../store'
import { createWindow } from './window'
import { SystemTray, SystemTrayEventHandlers } from './systemTray'
import { registerShortcut } from '../keyboardShortcuts'
import { Shortcut } from '../store/state/types/shortcuts'

const isDev = process.env.NODE_ENV === 'development'
const devToolsEnabled = process.env.ENABLE_DEV_TOOLS === 'true'

let mainWindow: BrowserWindow | null = null

const systemTrayEventHandlers: SystemTrayEventHandlers = {
  click: () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  },
  clickHide: () => mainWindow?.hide(),
  clickShow: () => {
    mainWindow?.show()
    mainWindow?.focus()
  }
}
const systemTray = new SystemTray(systemTrayEventHandlers)

function initMainWindow() {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  const url =
    isDev && rendererUrl
      ? `${rendererUrl}/index.html`
      : new URL(path.join(process.env.BUNDLE_LOCATION, 'index.html'), 'file:')

  mainWindow = createWindow('main', {
    width: 960,
    height: 680,
    minWidth: 680,
    minHeight: 480,
    icon: path.join(__dirname, './AppIcon.png')
  })

  mainWindow.loadURL(url.toString())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, res) => res(false))

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (devToolsEnabled) {
    mainWindow.webContents.openDevTools()
  }
}

// deny navigation, webview attachment & new windows on creation of webContents
electronApp.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (e) => e.preventDefault())
  contents.on('will-attach-webview', (e) => e.preventDefault())
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

if (isDev) {
  electronApp.once('ready', () => {
    globalShortcut.register('CommandOrControl+R', () => {
      mainWindow?.reload()
    })
  })
}

ipcMain.on('tray:quit', () => electronApp.quit())

ipcMain.on('*:contextmenu', (e, x, y) => {
  if (isDev) {
    e.sender.inspectElement(x, y)
  }
})

const windowFromWebContents = (webContents: WebContents) =>
  BrowserWindow.fromWebContents(webContents) as BrowserWindow

const init = () => {
  initMainWindow()

  // Initialize system tray after window is ready
  ipcMain.once('tray:ready', () => {
    if (mainWindow) {
      systemTray.init(mainWindow)
      systemTray.setContextMenu('show', {})
    }
  })

  // Register summon shortcut, re-register only when it changes
  const summonHandler = () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  }
  let lastShortcutJson = ''
  subscribe(state.main.shortcuts, () => {
    const summonShortcut: Shortcut = state.main.shortcuts.summon as Shortcut
    const json = JSON.stringify(summonShortcut)
    if (json === lastShortcutJson) return
    lastShortcutJson = json
    registerShortcut(summonShortcut, summonHandler)
  })
}

const send = (channel: string, ...args: string[]) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  } else {
    log.error(new Error('Main window does not exist (windows.send)'))
  }
}

// Sync state changes to renderer (only main state)
let _stateSyncCount = 0
let _stateSyncTimer: ReturnType<typeof setInterval> | null = null
subscribe(state, (ops: any[]) => {
  const mainOps = ops.filter(([_op, path]: any) => path[0] === 'main')
  if (mainOps.length === 0) return
  const updates = mainOps.map(([_op, path, value]: any) => ({ path: path.join('.'), value }))
  _stateSyncCount++
  if (!_stateSyncTimer) {
    _stateSyncTimer = setInterval(() => {
      if (_stateSyncCount > 0) {
        log.debug(`[stateSync] sent ${_stateSyncCount} messages in last 1s`)
        _stateSyncCount = 0
      } else {
        clearInterval(_stateSyncTimer!)
        _stateSyncTimer = null
      }
    }, 1000)
  }
  send('main:action', 'stateSync', JSON.stringify([{ updates }]))
})

export default {
  showWindow() {
    mainWindow?.show()
    mainWindow?.focus()
  },
  close(e: IpcMainEvent) {
    windowFromWebContents(e.sender).close()
  },
  max(e: IpcMainEvent) {
    windowFromWebContents(e.sender).maximize()
  },
  unmax(e: IpcMainEvent) {
    windowFromWebContents(e.sender).unmaximize()
  },
  min(e: IpcMainEvent) {
    windowFromWebContents(e.sender).minimize()
  },
  init
}
