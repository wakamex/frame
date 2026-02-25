import { v4 } from 'uuid'
import EventEmitter from 'events'

const source = 'tray:link'

const unwrap = (v: any) => (v !== undefined || v !== null ? JSON.parse(v) : v)
const wrap = (v: any) => (v !== undefined || v !== null ? JSON.stringify(v) : v)

const handlers: Record<string, (...args: any[]) => void> = {}

interface Link extends EventEmitter {
  rpc: (...args: any[]) => void
  send: (...args: any[]) => void
  invoke: (...args: any[]) => Promise<any>
}

const link = new EventEmitter() as Link

link.rpc = (...args: any[]) => {
  const cb = args.pop()
  if (typeof cb !== 'function') throw new Error('link.rpc requires a callback')
  const id = v4()
  handlers[id] = cb
  window.postMessage(wrap({ id, args, source, method: 'rpc' }), '*')
}

link.send = (...args: any[]) => {
  window.postMessage(wrap({ args, source, method: 'event' }), '*')
}

link.invoke = (...args: any[]) => {
  return new Promise((resolve) => {
    const id = v4()
    handlers[id] = resolve
    window.postMessage(wrap({ id, args, source, method: 'invoke' }), '*')
  })
}

const safeOrigins = ['file://'].concat(
  process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : []
)

window.addEventListener(
  'message',
  (e) => {
    if (!safeOrigins.includes(e.origin) || (e.data as any).source?.includes('react-devtools')) return
    const data = unwrap(e.data)
    const args = data.args || []
    if (data.source !== source) {
      if (data.method === 'rpc') {
        if (!handlers[data.id]) return console.log('link.rpc response had no handler')
        handlers[data.id](...args)
        delete handlers[data.id]
      } else if (data.method === 'invoke') {
        if (!handlers[data.id]) return console.log('link.invoke response had no handler')
        handlers[data.id](args)
        delete handlers[data.id]
      } else if (data.method === 'event') {
        if (!data.channel) return console.log('link.on event had no channel')
        link.emit(data.channel, ...args)
      }
    }
  },
  false
)

export default link
