import log from 'electron-log'

import { v38StateSchema } from '../38/schema'

function switchToPublic(connection: any) {
  if (connection.current === 'pylon') {
    return { ...connection, current: 'public' }
  }
  return connection
}

const migrate = (initial: unknown) => {
  try {
    const state = v38StateSchema.parse(initial)

    for (const [id, chain] of Object.entries(state.main.networks.ethereum)) {
      const c = chain as any
      if (c.connection) {
        c.connection = {
          primary: switchToPublic(c.connection.primary),
          secondary: switchToPublic(c.connection.secondary)
        }
        state.main.networks.ethereum[parseInt(id)] = c
      }
    }

    // Remove the migrateToPylon mute flag
    delete (state.main.mute as any).migrateToPylon

    return state
  } catch (e) {
    log.error('Migration 42: could not parse state', e)
  }

  return initial
}

export default {
  version: 42,
  migrate
}
