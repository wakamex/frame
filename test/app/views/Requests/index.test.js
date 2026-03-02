/**
 * @jest-environment jsdom
 */
import { render, screen, act, waitFor } from '../../../componentSetup'
import RequestOverlay from '../../../../app/views/Requests/index'
import TransactionReview from '../../../../app/views/Requests/TransactionReview'
import SignatureReview from '../../../../app/views/Requests/SignatureReview'
import AccessReview from '../../../../app/views/Requests/AccessReview'
import ChainTokenReview from '../../../../app/views/Requests/ChainTokenReview'

// Mock the IPC actions module
const mockApproveRequest = jest.fn()
const mockDeclineRequest = jest.fn()
const mockGiveAccess = jest.fn()
const mockAddChain = jest.fn()
const mockAddToken = jest.fn()
const mockRejectRequest = jest.fn()
const mockSwitchChain = jest.fn()
const mockClipboardData = jest.fn()

jest.mock('../../../../app/ipc', () => ({
  actions: {
    approveRequest: (...args) => mockApproveRequest(...args),
    declineRequest: (...args) => mockDeclineRequest(...args),
    giveAccess: (...args) => mockGiveAccess(...args),
    addChain: (...args) => mockAddChain(...args),
    addToken: (...args) => mockAddToken(...args),
    rejectRequest: (...args) => mockRejectRequest(...args),
    switchChain: (...args) => mockSwitchChain(...args),
    clipboardData: (...args) => mockClipboardData(...args),
    removeFeeUpdateNotice: jest.fn(),
    openExplorer: jest.fn()
  }
}))

// Mock store hooks
jest.mock('../../../../app/store', () => ({
  useNetworks: () => ({
    1: { id: 1, name: 'Ethereum', symbol: 'ETH' }
  }),
  useNetworksMeta: () => ({
    1: {
      nativeCurrency: { symbol: 'ETH', name: 'Ether', decimals: 18 }
    }
  }),
  useAccounts: () => ({})
}))

// Mock domain request utilities
jest.mock('../../../../resources/domain/request', () => ({
  accountViewTitles: {
    sign: 'Sign Message',
    signTypedData: 'Sign Data',
    signErc20Permit: 'Sign Token Permit',
    transaction: 'Sign Transaction',
    access: 'Account Access',
    addChain: 'Add Chain',
    switchChain: 'Switch Chain',
    addToken: 'Add Token'
  },
  isTransactionRequest: (req) => req.type === 'transaction',
  isSignatureRequest: (req) => ['sign', 'signTypedData', 'signErc20Permit'].includes(req.type)
}))

// Mock chain utils
jest.mock('../../../../resources/utils/chains', () => ({
  chainUsesOptimismFees: () => false
}))

// Mock useCountdown hook
jest.mock('../../../../resources/Hooks/useCountdown', () => ({
  __esModule: true,
  default: () => '23:59:59'
}))

// Base mock request objects
const makeTxRequest = (overrides = {}) => ({
  type: 'transaction',
  handlerId: 'tx-handler-1',
  status: 'pending',
  origin: 'test-origin.eth',
  data: {
    chainId: '0x1',
    to: '0xd1074e0ae85610ddba0147e29ebe0d8e5873a000',
    value: '0x38D7EA4C68000', // 0.001 ETH in wei
    gasLimit: '0x5208',
    maxFeePerGas: '0x3B9ACA00', // 1 gwei
    maxPriorityFeePerGas: '0x3B9ACA00'
  },
  payload: { params: [{ to: '0xd1074e0ae85610ddba0147e29ebe0d8e5873a000' }] },
  ...overrides
})

const makeSignRequest = (overrides = {}) => ({
  type: 'sign',
  handlerId: 'sign-handler-1',
  status: 'pending',
  origin: 'test-dapp.eth',
  data: {
    decodedMessage: 'Hello, World!'
  },
  payload: { params: ['0xabc', 'Hello, World!'] },
  ...overrides
})

const makeAccessRequest = (overrides = {}) => ({
  type: 'access',
  handlerId: 'access-handler-1',
  status: 'pending',
  origin: 'my-dapp.io',
  ...overrides
})

const makeAddChainRequest = (overrides = {}) => ({
  type: 'addChain',
  handlerId: 'chain-handler-1',
  status: 'pending',
  origin: 'chain-dapp.io',
  chain: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    explorer: 'https://polygonscan.com'
  },
  ...overrides
})

const makeAddTokenRequest = (overrides = {}) => ({
  type: 'addToken',
  handlerId: 'token-handler-1',
  status: 'pending',
  origin: 'token-dapp.io',
  token: {
    name: 'USDC',
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    decimals: 6
  },
  ...overrides
})

// ─── RequestOverlay (router / index.tsx) ───────────────────────────────────────

describe('RequestOverlay (router)', () => {
  it('renders nothing when requests array is empty', () => {
    render(<RequestOverlay requests={[]} />)
    expect(screen.queryByText('Sign Transaction')).toBeNull()
    expect(screen.queryByText('Sign Message')).toBeNull()
  })

  it('renders TransactionReview for transaction-type request', () => {
    render(<RequestOverlay requests={[makeTxRequest()]} />)
    expect(screen.getByText('Sign Transaction')).toBeDefined()
  })

  it('renders SignatureReview for sign-type request', () => {
    render(<RequestOverlay requests={[makeSignRequest()]} />)
    expect(screen.getByText('Sign Message')).toBeDefined()
  })

  it('renders AccessReview for access-type request', () => {
    render(<RequestOverlay requests={[makeAccessRequest()]} />)
    expect(screen.getByText('Account Access')).toBeDefined()
  })

  it('renders ChainTokenReview for addChain-type request', () => {
    render(<RequestOverlay requests={[makeAddChainRequest()]} />)
    expect(screen.getByText('Add Chain', { selector: 'h3' })).toBeDefined()
  })

  it('shows queue indicator when multiple requests', () => {
    render(<RequestOverlay requests={[makeTxRequest(), makeSignRequest()]} />)
    expect(screen.getByText(/1 of 2/)).toBeDefined()
  })

  it('renders signTypedData as SignatureReview', () => {
    const req = makeSignRequest({ type: 'signTypedData' })
    render(<RequestOverlay requests={[req]} />)
    expect(screen.getByText('Sign Data')).toBeDefined()
  })
})

// ─── TransactionReview ────────────────────────────────────────────────────────

describe('TransactionReview', () => {
  beforeEach(() => {
    mockApproveRequest.mockReset()
    mockDeclineRequest.mockReset()
  })

  it('displays transaction title', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.getByText('Sign Transaction')).toBeDefined()
  })

  it('displays origin and chain name', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.getByText(/test-origin\.eth/)).toBeDefined()
    expect(screen.getByText(/Ethereum/)).toBeDefined()
  })

  it('displays recipient address', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.getByText('To')).toBeDefined()
    // Address component shows the address
    expect(screen.getByTitle(/0xd1074e0ae85610ddba0147e29ebe0d8e5873a000/i)).toBeDefined()
  })

  it('displays ETH value when value is non-zero', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.getByText('Value')).toBeDefined()
    expect(screen.getByText(/ETH/)).toBeDefined()
  })

  it('displays gas info', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.getByText('Gas')).toBeDefined()
  })

  it('Approve button calls actions.approveRequest', async () => {
    mockApproveRequest.mockResolvedValue(undefined)
    const req = makeTxRequest()
    const { user } = render(<TransactionReview request={req} />)

    await user.click(screen.getByText('Approve'))
    expect(mockApproveRequest).toHaveBeenCalledWith(req)
    expect(mockDeclineRequest).not.toHaveBeenCalled()
  })

  it('Decline button calls actions.declineRequest', async () => {
    mockDeclineRequest.mockResolvedValue(undefined)
    const req = makeTxRequest()
    const { user } = render(<TransactionReview request={req} />)

    await user.click(screen.getByText('Decline'))
    expect(mockDeclineRequest).toHaveBeenCalledWith(req)
    expect(mockApproveRequest).not.toHaveBeenCalled()
  })

  it('shows recognized actions when available', () => {
    const req = makeTxRequest({
      recognizedActions: [{ type: 'erc20Transfer' }, { type: 'erc20Approve' }]
    })
    render(<TransactionReview request={req} />)
    expect(screen.getByText('Actions')).toBeDefined()
    expect(screen.getByText('erc20Transfer')).toBeDefined()
    expect(screen.getByText('erc20Approve')).toBeDefined()
  })

  it('does not show Actions section when no recognized actions', () => {
    render(<TransactionReview request={makeTxRequest()} />)
    expect(screen.queryByText('Actions')).toBeNull()
  })

  it('does not show Approve/Decline buttons when status is not pending', () => {
    const req = makeTxRequest({ status: 'confirmed' })
    render(<TransactionReview request={req} />)
    expect(screen.queryByText('Approve')).toBeNull()
    expect(screen.queryByText('Decline')).toBeNull()
  })

  it('shows status indicator', () => {
    render(<TransactionReview request={makeTxRequest({ status: 'pending' })} />)
    expect(screen.getByText('pending')).toBeDefined()
  })

  it('clicking Approve does not trigger Decline', async () => {
    mockApproveRequest.mockResolvedValue(undefined)
    mockDeclineRequest.mockResolvedValue(undefined)
    const req = makeTxRequest()
    const { user } = render(<TransactionReview request={req} />)

    await user.click(screen.getByText('Approve'))
    expect(mockApproveRequest).toHaveBeenCalledTimes(1)
    expect(mockDeclineRequest).not.toHaveBeenCalled()
  })
})

// ─── SignatureReview ───────────────────────────────────────────────────────────

describe('SignatureReview', () => {
  beforeEach(() => {
    mockApproveRequest.mockReset()
    mockDeclineRequest.mockReset()
  })

  it('displays sign title and origin', () => {
    render(<SignatureReview request={makeSignRequest()} />)
    expect(screen.getByText('Sign Message')).toBeDefined()
    expect(screen.getByText(/test-dapp\.eth/)).toBeDefined()
  })

  it('displays message content for plain sign request', () => {
    render(<SignatureReview request={makeSignRequest()} />)
    expect(screen.getByText('Message')).toBeDefined()
    expect(screen.getByText('Hello, World!')).toBeDefined()
  })

  it('displays message from payload when decodedMessage is absent', () => {
    const req = makeSignRequest({ data: {} })
    render(<SignatureReview request={req} />)
    expect(screen.getByText('Hello, World!')).toBeDefined()
  })

  it('Sign button calls actions.approveRequest', async () => {
    mockApproveRequest.mockResolvedValue(undefined)
    const req = makeSignRequest()
    const { user } = render(<SignatureReview request={req} />)

    await user.click(screen.getByText('Sign'))
    expect(mockApproveRequest).toHaveBeenCalledWith(req)
    expect(mockDeclineRequest).not.toHaveBeenCalled()
  })

  it('Decline button calls actions.declineRequest', async () => {
    mockDeclineRequest.mockResolvedValue(undefined)
    const req = makeSignRequest()
    const { user } = render(<SignatureReview request={req} />)

    await user.click(screen.getByText('Decline'))
    expect(mockDeclineRequest).toHaveBeenCalledWith(req)
    expect(mockApproveRequest).not.toHaveBeenCalled()
  })

  it('does not show buttons when status is not pending', () => {
    const req = makeSignRequest({ status: 'confirmed' })
    render(<SignatureReview request={req} />)
    expect(screen.queryByText('Sign')).toBeNull()
    expect(screen.queryByText('Decline')).toBeNull()
  })

  it('renders typed data view for signTypedData type', () => {
    const req = makeSignRequest({
      type: 'signTypedData',
      typedMessage: {
        data: {
          primaryType: 'Order',
          domain: { name: 'TestDomain', chainId: 1 },
          message: { amount: '100' }
        }
      }
    })
    render(<SignatureReview request={req} />)
    expect(screen.getByText('Sign Data')).toBeDefined()
    expect(screen.getByText('Typed Data')).toBeDefined()
    expect(screen.getByText(/Order/)).toBeDefined()
  })

  it('clicking Sign does not trigger Decline', async () => {
    mockApproveRequest.mockResolvedValue(undefined)
    const req = makeSignRequest()
    const { user } = render(<SignatureReview request={req} />)

    await user.click(screen.getByText('Sign'))
    expect(mockApproveRequest).toHaveBeenCalledTimes(1)
    expect(mockDeclineRequest).not.toHaveBeenCalled()
  })
})

// ─── AccessReview ─────────────────────────────────────────────────────────────

describe('AccessReview', () => {
  beforeEach(() => {
    mockGiveAccess.mockReset()
  })

  it('displays Account Access title', () => {
    render(<AccessReview request={makeAccessRequest()} />)
    expect(screen.getByText('Account Access')).toBeDefined()
  })

  it('shows origin requesting access', () => {
    render(<AccessReview request={makeAccessRequest()} />)
    expect(screen.getByText('my-dapp.io')).toBeDefined()
    expect(screen.getByText(/wants to connect to your account/)).toBeDefined()
  })

  it('Allow button calls giveAccess with true', async () => {
    const req = makeAccessRequest()
    const { user } = render(<AccessReview request={req} />)

    await user.click(screen.getByText('Allow'))
    expect(mockGiveAccess).toHaveBeenCalledWith(req, true)
    expect(mockGiveAccess).toHaveBeenCalledTimes(1)
  })

  it('Deny button calls giveAccess with false', async () => {
    const req = makeAccessRequest()
    const { user } = render(<AccessReview request={req} />)

    await user.click(screen.getByText('Deny'))
    expect(mockGiveAccess).toHaveBeenCalledWith(req, false)
    expect(mockGiveAccess).toHaveBeenCalledTimes(1)
  })

  it('does not show Allow/Deny buttons when not pending', () => {
    const req = makeAccessRequest({ status: 'confirmed' })
    render(<AccessReview request={req} />)
    expect(screen.queryByText('Allow')).toBeNull()
    expect(screen.queryByText('Deny')).toBeNull()
  })

  it('clicking Allow does not trigger Deny', async () => {
    const req = makeAccessRequest()
    const { user } = render(<AccessReview request={req} />)

    await user.click(screen.getByText('Allow'))
    expect(mockGiveAccess).toHaveBeenCalledTimes(1)
    expect(mockGiveAccess).toHaveBeenCalledWith(req, true)
  })
})

// ─── ChainTokenReview ─────────────────────────────────────────────────────────

describe('ChainTokenReview — addChain', () => {
  beforeEach(() => {
    mockAddChain.mockReset()
    mockRejectRequest.mockReset()
  })

  it('shows Add Chain title', () => {
    render(<ChainTokenReview request={makeAddChainRequest()} />)
    expect(screen.getByText('Add Chain', { selector: 'h3' })).toBeDefined()
  })

  it('shows chain details', () => {
    render(<ChainTokenReview request={makeAddChainRequest()} />)
    expect(screen.getByText('Polygon')).toBeDefined()
    expect(screen.getByText(/Chain ID: 137/)).toBeDefined()
    expect(screen.getByText(/MATIC/)).toBeDefined()
  })

  it('shows origin requesting chain add', () => {
    render(<ChainTokenReview request={makeAddChainRequest()} />)
    expect(screen.getByText(/chain-dapp\.io/)).toBeDefined()
  })

  it('Add Chain button calls actions.addChain', async () => {
    const req = makeAddChainRequest()
    const { user } = render(<ChainTokenReview request={req} />)

    await user.click(screen.getByRole('button', { name: 'Add Chain' }))
    expect(mockAddChain).toHaveBeenCalledWith(req.chain)
    expect(mockRejectRequest).not.toHaveBeenCalled()
  })

  it('Decline button calls actions.rejectRequest', async () => {
    const req = makeAddChainRequest()
    const { user } = render(<ChainTokenReview request={req} />)

    await user.click(screen.getByRole('button', { name: 'Decline' }))
    expect(mockRejectRequest).toHaveBeenCalledWith(req)
    expect(mockAddChain).not.toHaveBeenCalled()
  })
})

describe('ChainTokenReview — addToken', () => {
  beforeEach(() => {
    mockAddToken.mockReset()
    mockRejectRequest.mockReset()
  })

  it('shows Add Token title and token details', () => {
    render(<ChainTokenReview request={makeAddTokenRequest()} />)
    expect(screen.getByText('Add Token', { selector: 'h3' })).toBeDefined()
    expect(screen.getByText('USDC')).toBeDefined()
    expect(screen.getByText(/Symbol: USDC/)).toBeDefined()
  })

  it('Add Token button calls actions.addToken', async () => {
    const req = makeAddTokenRequest()
    const { user } = render(<ChainTokenReview request={req} />)

    await user.click(screen.getByRole('button', { name: 'Add Token' }))
    expect(mockAddToken).toHaveBeenCalledWith(req.token, req)
  })
})

describe('ChainTokenReview — switchChain', () => {
  beforeEach(() => {
    mockSwitchChain.mockReset()
    mockRejectRequest.mockReset()
  })

  it('shows Switch Chain title and chain id', () => {
    const req = {
      type: 'switchChain',
      handlerId: 'switch-handler-1',
      status: 'pending',
      origin: 'switch-dapp.io',
      payload: { params: [{ chainId: '0x89' }] } // 137
    }
    render(<ChainTokenReview request={req} />)
    expect(screen.getByText('Switch Chain')).toBeDefined()
    expect(screen.getByText(/Chain ID: 137/)).toBeDefined()
  })

  it('Switch button calls actions.switchChain', async () => {
    const req = {
      type: 'switchChain',
      handlerId: 'switch-handler-1',
      status: 'pending',
      origin: 'switch-dapp.io',
      payload: { params: [{ chainId: '0x89' }] }
    }
    const { user } = render(<ChainTokenReview request={req} />)

    await user.click(screen.getByText('Switch'))
    expect(mockSwitchChain).toHaveBeenCalledWith('ethereum', 137, req)
  })
})
