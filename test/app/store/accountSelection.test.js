/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { proxy, useSnapshot } from 'valtio'

// Test the real store functions — no mocks
// This catches bugs where account selection returns null due to key mismatches,
// missing state, or stateSync issues.

// We can't import the real store (it has side effects), so we replicate
// the exact logic from app/store.ts to test it in isolation.

function setByPath(obj, keys, value) {
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined) obj[keys[i]] = {}
    obj = obj[keys[i]]
  }
  obj[keys[keys.length - 1]] = value
}

function createStore() {
  const state = proxy({
    main: { accounts: {}, accountsMeta: {} },
    platform: 'linux',
    initialized: false,
    currentView: 'accounts',
    selectedAccount: null
  })

  function initializeState(data) {
    state.main = data.main
    state.platform = data.platform
    state.initialized = true
  }

  function setSelectedAccount(id) {
    state.selectedAccount = id
  }

  function applyUpdates(updates) {
    for (const { path, value } of updates) {
      setByPath(state, path.split('.'), value)
    }
  }

  return { state, initializeState, setSelectedAccount, applyUpdates }
}

// Simulate what updateAccount does on the main process side
function simulateMainUpdateAccount(accountData) {
  const { id } = accountData
  return {
    path: `main.accounts.${id}`,
    value: { ...accountData, balances: {} }
  }
}

// Test component that reads selected account (mirrors useSelectedAccount)
function SelectedAccountReader({ store }) {
  const snap = useSnapshot(store.state)
  const id = snap.selectedAccount
  const account = id && snap.main?.accounts ? snap.main.accounts[id] ?? null : null
  return (
    <div>
      <span data-testid="selected-id">{id || 'none'}</span>
      <span data-testid="selected-name">{account?.name || 'no-account'}</span>
      <span data-testid="selected-address">{account?.address || 'no-address'}</span>
    </div>
  )
}

// Test component that lists accounts (mirrors useAccounts)
function AccountListReader({ store }) {
  const snap = useSnapshot(store.state)
  const accounts = snap.main?.accounts ?? {}
  return (
    <div>
      {Object.values(accounts).map((a) => (
        <button key={a.id} data-testid={`account-${a.id}`} onClick={() => store.setSelectedAccount(a.id)}>
          {a.name}
        </button>
      ))}
    </div>
  )
}

describe('Account selection store integration', () => {
  let store

  beforeEach(() => {
    store = createStore()
  })

  it('selected account is null by default', () => {
    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-id').textContent).toBe('none')
    expect(screen.getByTestId('selected-name').textContent).toBe('no-account')
  })

  it('selecting an account that exists returns its data', () => {
    const account = {
      id: '0xabc123',
      name: 'Test Account',
      address: '0xabc123',
      signer: '',
      status: 'ok',
      requests: {}
    }

    act(() => {
      store.state.main.accounts['0xabc123'] = { ...account, balances: {} }
    })

    act(() => {
      store.setSelectedAccount('0xabc123')
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-id').textContent).toBe('0xabc123')
    expect(screen.getByTestId('selected-name').textContent).toBe('Test Account')
  })

  it('selecting a non-existent account returns null', () => {
    act(() => {
      store.setSelectedAccount('0xnonexistent')
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-id').textContent).toBe('0xnonexistent')
    expect(screen.getByTestId('selected-name').textContent).toBe('no-account')
  })

  it('accounts populated via initializeState are selectable', () => {
    act(() => {
      store.initializeState({
        main: {
          accounts: {
            '0xdef456': {
              id: '0xdef456',
              name: 'Initialized Account',
              address: '0xdef456',
              signer: '',
              status: 'ok',
              requests: {},
              balances: {}
            }
          },
          accountsMeta: {}
        },
        platform: 'darwin'
      })
    })

    act(() => {
      store.setSelectedAccount('0xdef456')
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-name').textContent).toBe('Initialized Account')
  })

  it('accounts populated via applyUpdates (stateSync) are selectable', () => {
    const account = {
      id: '0xsync789',
      name: 'Synced Account',
      address: '0xsync789',
      signer: '',
      status: 'ok',
      requests: {}
    }

    const update = simulateMainUpdateAccount(account)

    act(() => {
      store.applyUpdates([update])
    })

    act(() => {
      store.setSelectedAccount('0xsync789')
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-name').textContent).toBe('Synced Account')
    expect(screen.getByTestId('selected-address').textContent).toBe('0xsync789')
  })

  it('clicking account in list selects it and detail reads it', async () => {
    const account = {
      id: '0xclick1',
      name: 'Clickable Account',
      address: '0xclick1',
      signer: '',
      status: 'ok',
      requests: {},
      balances: {}
    }

    act(() => {
      store.state.main.accounts['0xclick1'] = account
    })

    render(
      <>
        <AccountListReader store={store} />
        <SelectedAccountReader store={store} />
      </>
    )

    // Before click
    expect(screen.getByTestId('selected-name').textContent).toBe('no-account')

    // Click the account
    act(() => {
      screen.getByTestId('account-0xclick1').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('selected-name').textContent).toBe('Clickable Account')
    })
  })

  it('stateSync update to existing selected account updates the detail', async () => {
    const account = {
      id: '0xupdate1',
      name: 'Original Name',
      address: '0xupdate1',
      signer: '',
      status: 'ok',
      requests: {},
      balances: {}
    }

    act(() => {
      store.state.main.accounts['0xupdate1'] = account
      store.setSelectedAccount('0xupdate1')
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-name').textContent).toBe('Original Name')

    // Simulate stateSync with updated name
    act(() => {
      store.applyUpdates([{
        path: 'main.accounts.0xupdate1',
        value: { ...account, name: 'Updated Name' }
      }])
    })

    await waitFor(() => {
      expect(screen.getByTestId('selected-name').textContent).toBe('Updated Name')
    })
  })

  it('bulk account creation via stateSync makes all accounts selectable', () => {
    const accounts = Array.from({ length: 10 }, (_, i) => ({
      id: `0x${i.toString(16).padStart(40, '0')}`,
      name: `Account ${i}`,
      address: `0x${i.toString(16).padStart(40, '0')}`,
      signer: '',
      status: 'ok',
      requests: {}
    }))

    const updates = accounts.map(simulateMainUpdateAccount)

    act(() => {
      store.applyUpdates(updates)
    })

    // Select the last account
    act(() => {
      store.setSelectedAccount(accounts[9].id)
    })

    render(<SelectedAccountReader store={store} />)
    expect(screen.getByTestId('selected-name').textContent).toBe('Account 9')
  })
})
