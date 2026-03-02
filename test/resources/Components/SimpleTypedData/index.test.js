/**
 * @jest-environment jsdom
 */
import { render, screen, act } from '../../../componentSetup'
import { SimpleTypedData } from '../../../../resources/Components/SimpleTypedData'

function makeReq(type, data) {
  return {
    type,
    typedMessage: { data }
  }
}

describe('SimpleTypedData with signTypedData', () => {
  it('renders domain fields', () => {
    const req = makeReq('signTypedData', {
      domain: {
        name: 'MyToken',
        version: '2',
        chainId: 137,
        verifyingContract: '0xabc123'
      },
      message: {}
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Domain')).toBeDefined()
    expect(screen.getByText('name')).toBeDefined()
    expect(screen.getByText('MyToken')).toBeDefined()
    expect(screen.getByText('version')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('chain Id')).toBeDefined()
    expect(screen.getByText('137')).toBeDefined()
    // camelCase "verifyingContract" → "verifying Contract"
    expect(screen.getByText('verifying Contract')).toBeDefined()
    expect(screen.getByText('0xabc123')).toBeDefined()
  })

  it('renders message fields with correct labels', () => {
    const req = makeReq('signTypedData', {
      domain: { name: 'Test' },
      message: {
        from: '0xSender',
        to: '0xReceiver',
        amount: '1000'
      }
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Message')).toBeDefined()
    expect(screen.getByText('from')).toBeDefined()
    expect(screen.getByText('0xSender')).toBeDefined()
    expect(screen.getByText('to')).toBeDefined()
    expect(screen.getByText('0xReceiver')).toBeDefined()
    expect(screen.getByText('amount')).toBeDefined()
    expect(screen.getByText('1000')).toBeDefined()
  })

  it('handles nested struct data (recursive rendering)', () => {
    const req = makeReq('signTypedData', {
      domain: { name: 'Test' },
      message: {
        metadata: {
          symbol: 'ETH',
          decimals: 18
        }
      }
    })

    render(<SimpleTypedData req={req} />)

    // camelCase "metadata" has no caps → stays "metadata"
    expect(screen.getByText('metadata')).toBeDefined()
    expect(screen.getByText('symbol')).toBeDefined()
    expect(screen.getByText('ETH')).toBeDefined()
    expect(screen.getByText('decimals')).toBeDefined()
    expect(screen.getByText('18')).toBeDefined()
  })

  it('handles camelCase keys by inserting spaces before capitals', () => {
    const req = makeReq('signTypedData', {
      domain: {},
      message: {
        verifyingContract: '0xcontract'
      }
    })

    render(<SimpleTypedData req={req} />)

    // camelCase key "verifyingContract" → "verifying Contract"
    expect(screen.getByText('verifying Contract')).toBeDefined()
  })

  it('renders the Raw Typed Data header', () => {
    const req = makeReq('signTypedData', {
      domain: { name: 'Test' },
      message: {}
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Raw Typed Data')).toBeDefined()
  })
})

describe('SimpleTypedData with signErc20Permit', () => {
  it('renders domain and message sections for signErc20Permit type', () => {
    const req = makeReq('signErc20Permit', {
      domain: { name: 'MyToken', chainId: 1 },
      message: { spender: '0xspender', value: '100' }
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Domain')).toBeDefined()
    expect(screen.getByText('Message')).toBeDefined()
    expect(screen.getByText('MyToken')).toBeDefined()
    expect(screen.getByText('0xspender')).toBeDefined()
  })
})

describe('SimpleTypedData with unknown type', () => {
  it('renders unknown type message', () => {
    const req = makeReq('unknownType', {
      domain: { name: 'Test' },
      message: {}
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Unknown: unknownType')).toBeDefined()
  })
})

describe('SimpleTypedData with array-style typedData', () => {
  it('handles array-style typed data (no domain field)', () => {
    const req = makeReq('signTypedData', [
      { name: 'recipient', value: '0xabc' },
      { name: 'amount', value: '500' }
    ])

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('recipient')).toBeDefined()
    expect(screen.getByText('0xabc')).toBeDefined()
    expect(screen.getByText('amount')).toBeDefined()
    expect(screen.getByText('500')).toBeDefined()
  })

  it('handles empty array typed data', () => {
    const req = makeReq('signTypedData', [])

    render(<SimpleTypedData req={req} />)

    expect(document.querySelector('.signTypedDataSection')).not.toBeNull()
  })
})

describe('SimpleTypedData with primitive values', () => {
  it('handles address, uint256, and string values in message', () => {
    const req = makeReq('signTypedData', {
      domain: {},
      message: {
        owner: '0xowner123',
        nonce: 42,
        memo: 'hello'
      }
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('0xowner123')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('hello')).toBeDefined()
  })

  it('does not render boolean false values (React ignores booleans)', () => {
    const req = makeReq('signTypedData', {
      domain: {},
      message: {
        label: 'check',
        enabled: false
      }
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('label')).toBeDefined()
    expect(screen.getByText('check')).toBeDefined()
    // boolean false is ignored by React renderer
    expect(screen.queryByText('false')).toBeNull()
  })
})

describe('SimpleTypedData with empty/missing optional fields', () => {
  it('handles empty domain gracefully', () => {
    const req = makeReq('signTypedData', {
      domain: {},
      message: { value: 'test' }
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Domain')).toBeDefined()
    expect(screen.getByText('Message')).toBeDefined()
  })

  it('handles empty message gracefully', () => {
    const req = makeReq('signTypedData', {
      domain: { name: 'Test' },
      message: {}
    })

    render(<SimpleTypedData req={req} />)

    expect(screen.getByText('Domain')).toBeDefined()
    expect(screen.getByText('Message')).toBeDefined()
    expect(screen.getByText('Test')).toBeDefined()
  })
})
