import http from './http'
import ws from './ws'

export function startApi() {
  ws(http()).listen(1248, '127.0.0.1')
}
