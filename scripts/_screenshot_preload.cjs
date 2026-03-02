/**
 * Custom preload for screenshot tool.
 * Directly mocks the IPC layer that the bridge provides, bypassing
 * the real bridge.js to avoid bridge/link message-passing issues.
 */
const { ipcRenderer } = require('electron')

// The bridge normally sets up a message listener that forwards postMessage to IPC.
// Instead, we intercept postMessages from the link module and respond directly
// with mock data from the main process.

const source = 'bridge:link'

const unwrap = (v) => (v !== undefined || v !== null ? JSON.parse(v) : v)
const wrap = (v) => (v !== undefined || v !== null ? JSON.stringify(v) : v)

// Forward RPC calls to main process (same as real bridge)
let rpcId = 0
const rpcHandlers = {}

ipcRenderer.on('main:rpc', (_sender, id, ...args) => {
  const handlerId = parseInt(id)
  if (!rpcHandlers[handlerId]) {
    console.log('Bridge: no handler for RPC reply', id)
    return
  }
  args = args.map((arg) => {
    try { return JSON.parse(arg) } catch { return arg }
  })
  console.log('Bridge: RPC reply received for id', handlerId)
  rpcHandlers[handlerId](...args)
  delete rpcHandlers[handlerId]
})

function rpc(...args) {
  const cb = args.pop()
  if (typeof cb !== 'function') throw new Error('RPC requires a callback')
  const id = ++rpcId
  rpcHandlers[id] = cb
  args = args.map((arg) => JSON.stringify(arg))
  console.log('Bridge: sending RPC to main, id:', id, 'args:', args[0])
  ipcRenderer.send('main:rpc', JSON.stringify(id), ...args)
}

// Listen for postMessage from the renderer (link module)
window.addEventListener('message', (e) => {
  // Accept any origin in screenshot mode
  if (e.data && typeof e.data === 'string') {
    let data
    try { data = JSON.parse(e.data) } catch { return }
    if (data.source === source) return // our own messages, ignore

    if (data.method === 'rpc') {
      console.log('Bridge: received RPC request from renderer')
      rpc(...data.args, (...args) => {
        const response = wrap({ method: 'rpc', id: data.id, args, source })
        window.postMessage(response, '*')
        console.log('Bridge: posted RPC response back to renderer')
      })
    } else if (data.method === 'event') {
      ipcRenderer.send(...data.args)
    } else if (data.method === 'invoke') {
      ;(async () => {
        const args = await ipcRenderer.invoke(...data.args)
        window.postMessage(wrap({ method: 'invoke', channel: 'action', id: data.id, args, source }), '*')
      })()
    }
  }
}, false)

// Forward main:action events from main to renderer (for state sync)
ipcRenderer.on('main:action', (...args) => {
  args.shift()
  window.postMessage(wrap({ method: 'event', channel: 'action', args, source }), '*')
})

ipcRenderer.on('main:flex', (...args) => {
  args.shift()
  window.postMessage(wrap({ method: 'event', channel: 'flex', args, source }), '*')
})

console.log('Screenshot preload loaded')
