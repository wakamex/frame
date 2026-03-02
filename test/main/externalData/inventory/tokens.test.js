jest.mock('electron-log')
jest.mock('../../../../main/externalData/inventory/default-tokens.json', () => ({
  tokens: [
    { name: 'USDC', symbol: 'USDC', address: '0xA0b8...', chainId: 1, decimals: 6 },
    { name: 'DAI', symbol: 'DAI', address: '0x6B17...', chainId: 1, decimals: 18 },
    { name: 'USDC', symbol: 'USDC', address: '0x2791...', chainId: 137, decimals: 6 },
    { name: 'BadToken', symbol: 'BAD', address: '0xBAD...', chainId: 1, decimals: 18, extensions: { omit: true } },
    { name: 'OmittedPoly', symbol: 'OP', address: '0xOMIT...', chainId: 137, decimals: 18, extensions: { omit: true } }
  ]
}))

import TokenLoader from '../../../../main/externalData/inventory/tokens'

let tokenLoader

beforeEach(() => {
  tokenLoader = new TokenLoader()
})

describe('getTokens', () => {
  it('returns tokens for specified chains', () => {
    const tokens = tokenLoader.getTokens([1])

    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'USDC', chainId: 1 }),
        expect.objectContaining({ name: 'DAI', chainId: 1 })
      ])
    )
  })

  it('excludes blacklisted tokens (extensions.omit=true)', () => {
    const tokens = tokenLoader.getTokens([1])

    expect(tokens.find((t) => t.name === 'BadToken')).toBeUndefined()
    expect(tokens.every((t) => !t.extensions?.omit)).toBe(true)
  })

  it('returns empty array for chain with no tokens', () => {
    const tokens = tokenLoader.getTokens([999])

    expect(tokens).toEqual([])
  })

  it('multiple chains returns tokens from all specified chains', () => {
    const tokens = tokenLoader.getTokens([1, 137])

    const chainIds = tokens.map((t) => t.chainId)
    expect(chainIds).toContain(1)
    expect(chainIds).toContain(137)
  })

  it('single chain filters correctly', () => {
    const tokens = tokenLoader.getTokens([137])

    expect(tokens.every((t) => t.chainId === 137)).toBe(true)
    expect(tokens.find((t) => t.chainId === 1)).toBeUndefined()
  })
})

describe('getBlacklist', () => {
  it('returns only blacklisted tokens', () => {
    const blacklist = tokenLoader.getBlacklist()

    expect(blacklist.every((t) => t.extensions?.omit)).toBe(true)
    expect(blacklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'BadToken' }),
        expect.objectContaining({ name: 'OmittedPoly' })
      ])
    )
  })

  it('with chains filter returns blacklisted tokens for those chains', () => {
    const blacklist = tokenLoader.getBlacklist([1])

    expect(blacklist.every((t) => t.chainId === 1)).toBe(true)
    expect(blacklist.find((t) => t.name === 'BadToken')).toBeTruthy()
    expect(blacklist.find((t) => t.name === 'OmittedPoly')).toBeUndefined()
  })

  it('empty chains array returns all blacklisted tokens', () => {
    const blacklist = tokenLoader.getBlacklist([])

    expect(blacklist.length).toBe(2)
    expect(blacklist.find((t) => t.name === 'BadToken')).toBeTruthy()
    expect(blacklist.find((t) => t.name === 'OmittedPoly')).toBeTruthy()
  })

  it('no chains arg returns all blacklisted tokens', () => {
    const blacklist = tokenLoader.getBlacklist()

    expect(blacklist.length).toBe(2)
    expect(blacklist.find((t) => t.name === 'BadToken')).toBeTruthy()
    expect(blacklist.find((t) => t.name === 'OmittedPoly')).toBeTruthy()
  })
})

describe('isBlacklisted (via getTokens/getBlacklist)', () => {
  it('token without extensions is not blacklisted', () => {
    const tokens = tokenLoader.getTokens([1])
    const dai = tokens.find((t) => t.name === 'DAI')

    expect(dai).toBeDefined()
    expect(dai.extensions).toBeUndefined()
  })

  it('token with extensions.omit=false is not blacklisted', () => {
    // Add a token with omit=false — it should appear in getTokens, not getBlacklist
    const notOmittedToken = { name: 'SafeToken', symbol: 'SAFE', address: '0xSAFE...', chainId: 1, decimals: 18, extensions: { omit: false } }
    tokenLoader.tokens = [notOmittedToken]

    const tokens = tokenLoader.getTokens([1])
    const blacklist = tokenLoader.getBlacklist([1])

    expect(tokens.find((t) => t.name === 'SafeToken')).toBeDefined()
    expect(blacklist.find((t) => t.name === 'SafeToken')).toBeUndefined()
  })
})

describe('lifecycle', () => {
  it('start resolves without error', async () => {
    await expect(tokenLoader.start()).resolves.toBeUndefined()
  })

  it('stop completes without error', () => {
    expect(() => tokenLoader.stop()).not.toThrow()
  })
})

describe('invariants', () => {
  it('no token appears in both getTokens and getBlacklist for the same chain', () => {
    const tokens = tokenLoader.getTokens([1, 137])
    const blacklist = tokenLoader.getBlacklist([1, 137])

    const tokenAddresses = new Set(tokens.map((t) => t.address))
    const blacklistAddresses = new Set(blacklist.map((t) => t.address))

    const overlap = [...tokenAddresses].filter((addr) => blacklistAddresses.has(addr))
    expect(overlap).toEqual([])
  })
})
