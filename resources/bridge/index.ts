import { ipcRenderer } from 'electron'
import rpc from './rpc'

const unwrap = (v: any) => (v !== undefined || v !== null ? JSON.parse(v) : v)
const wrap = (v: any) => (v !== undefined || v !== null ? JSON.stringify(v) : v)
const source = 'bridge:link'
const safeOrigins = ['file://'].concat(
  process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : []
)

window.addEventListener(
  'message',
  (e) => {
    if (!safeOrigins.includes(e.origin) || (e.data as any).source?.includes('react-devtools')) return
    const data = unwrap(e.data)
    if (data.source !== source) {
      if (data.method === 'rpc') {
        return rpc(...data.args, (...args: any[]) =>
          (e.source as Window).postMessage(wrap({ method: 'rpc', id: data.id, args, source }), e.origin)
        )
      }
      if (data.method === 'event') return ipcRenderer.send(...data.args)
      if (data.method === 'invoke') {
        ;(async () => {
          const args = await ipcRenderer.invoke(...data.args)
          window.postMessage(wrap({ method: 'invoke', channel: 'action', id: data.id, args, source }), '*')
        })()
      }
    }
  },
  false
)

ipcRenderer.on('main:action', (...args: any[]) => {
  args.shift()
  window.postMessage(wrap({ method: 'event', channel: 'action', args, source }), '*')
})

ipcRenderer.on('main:flex', (...args: any[]) => {
  args.shift()
  window.postMessage(wrap({ method: 'event', channel: 'flex', args, source }), '*')
})
