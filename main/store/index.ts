import state from './state'
import * as actions from './actions'
import persist from './persist'
import { createCompatStore } from './storeCompat'

const store = createCompatStore(state(), actions)

// Persist initial full state
persist.set('main', store('main'))

// Apply updates to persisted state
store.api.feed((_state, actionBatch) => {
  actionBatch.forEach((action) => {
    action.updates.forEach((update) => {
      persist.queue(update.path, update.value)
    })
  })
})

export default store
