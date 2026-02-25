import { ipcRenderer } from 'electron'

let i = 0
const newId = () => ++i

const defined = (value: any) => value !== undefined || value !== null

const handlers: Record<number, (...args: any[]) => void> = {}

ipcRenderer.on('main:rpc', (_sender, id: string, ...args: any[]) => {
  const handlerId = parseInt(id)
  if (!handlers[handlerId]) return console.log('Message from main RPC had no handler:', args)
  args = args.map((arg) => (defined(arg) ? JSON.parse(arg) : arg))
  handlers[handlerId](...args)
  delete handlers[handlerId]
})

export default (...args: any[]) => {
  const cb = args.pop()
  if (typeof cb !== 'function') throw new Error('Main RPC requires a callback')
  const id = newId()
  handlers[id] = cb
  args = args.map((arg) => (defined(arg) ? JSON.stringify(arg) : arg))
  ipcRenderer.send('main:rpc', JSON.stringify(id), ...args)
}
