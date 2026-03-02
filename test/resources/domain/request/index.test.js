import {
  isCancelableRequest,
  isSignatureRequest,
  isTransactionRequest,
  isTypedMessageSignatureRequest,
  getSignatureRequestClass,
  accountViewTitles
} from '../../../../resources/domain/request'

describe('#isCancelableRequest', () => {
  const nonCancelableStatuses = ['sent', 'sending', 'verifying', 'confirming', 'confirmed', 'error', 'declined']

  nonCancelableStatuses.forEach((status) => {
    it(`returns false for '${status}'`, () => {
      expect(isCancelableRequest(status)).toBe(false)
    })
  })

  it('returns true for pending status', () => {
    expect(isCancelableRequest('pending')).toBe(true)
  })

  it('returns true for waiting status', () => {
    expect(isCancelableRequest('waiting')).toBe(true)
  })

  it('returns true for unknown statuses', () => {
    expect(isCancelableRequest('unknown')).toBe(true)
  })
})

describe('#isSignatureRequest', () => {
  const signatureTypes = ['sign', 'signTypedData', 'signErc20Permit']

  signatureTypes.forEach((type) => {
    it(`returns true for '${type}'`, () => {
      expect(isSignatureRequest({ type })).toBe(true)
    })
  })

  const nonSignatureTypes = ['transaction', 'access', 'addChain']

  nonSignatureTypes.forEach((type) => {
    it(`returns false for '${type}'`, () => {
      expect(isSignatureRequest({ type })).toBe(false)
    })
  })
})

describe('#isTransactionRequest', () => {
  it('returns true for transaction type', () => {
    expect(isTransactionRequest({ type: 'transaction' })).toBe(true)
  })

  it('returns false for sign type', () => {
    expect(isTransactionRequest({ type: 'sign' })).toBe(false)
  })

  it('returns false for signTypedData type', () => {
    expect(isTransactionRequest({ type: 'signTypedData' })).toBe(false)
  })
})

describe('#isTypedMessageSignatureRequest', () => {
  it('returns true for signTypedData type', () => {
    expect(isTypedMessageSignatureRequest({ type: 'signTypedData' })).toBe(true)
  })

  it('returns true for signErc20Permit type', () => {
    expect(isTypedMessageSignatureRequest({ type: 'signErc20Permit' })).toBe(true)
  })

  it('returns false for sign type', () => {
    expect(isTypedMessageSignatureRequest({ type: 'sign' })).toBe(false)
  })

  it('returns false for transaction type', () => {
    expect(isTypedMessageSignatureRequest({ type: 'transaction' })).toBe(false)
  })
})

describe('#getSignatureRequestClass', () => {
  it("returns 'signerRequest Pending' for 'pending'", () => {
    expect(getSignatureRequestClass({ status: 'pending' })).toBe('signerRequest Pending')
  })

  it("returns 'signerRequest Sent' for 'sent'", () => {
    expect(getSignatureRequestClass({ status: 'sent' })).toBe('signerRequest Sent')
  })

  it("returns 'signerRequest ' when no status provided", () => {
    expect(getSignatureRequestClass({})).toBe('signerRequest ')
  })
})

describe('accountViewTitles', () => {
  const expectedTitles = {
    sign: 'Sign Message',
    signTypedData: 'Sign Data',
    signErc20Permit: 'Sign Token Permit',
    transaction: 'Sign Transaction',
    access: 'Account Access',
    addChain: 'Add Chain',
    switchChain: 'Switch Chain',
    addToken: 'Add Token'
  }

  Object.entries(expectedTitles).forEach(([type, title]) => {
    it(`maps '${type}' to '${title}'`, () => {
      expect(accountViewTitles[type]).toBe(title)
    })
  })
})
