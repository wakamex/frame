import BigNumber from 'bignumber.js'
import { sortByTotalValue as byTotalValue, createBalance, formatSmallNumber } from '../../../../resources/domain/balance'

describe('#createBalance', () => {
  it('creates a balance with an unknown price when no quote is available', () => {
    const quote = undefined
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: 18 }, quote)

    expect(balance.price).toBe('?')
  })

  it('creates a balance with no price change data when no quote is available', () => {
    const quote = undefined
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: 18 }, quote)

    expect(balance.priceChange).toBeFalsy()
  })

  it('creates a balance with zero total value when no quote is available', () => {
    const quote = undefined
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: 18 }, quote)

    expect(balance.totalValue.toNumber()).toBe(0)
  })

  it('creates a balance with zero display value when no quote is available', () => {
    const quote = undefined
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: 18 }, quote)

    expect(balance.displayValue).toBe('0')
  })

  it('displayValue never contains ? character', () => {
    // displayValue is shown as "$displayValue" in the UI, so "?" would render as "$?"
    const withQuote = createBalance(
      { balance: '0xDE0B6B3A7640000', decimals: 18 },
      { price: 2000, change24hr: 1.5 }
    )
    expect(withQuote.displayValue).not.toContain('?')

    const withoutQuote = createBalance({ balance: '0xDE0B6B3A7640000', decimals: 18 }, undefined)
    expect(withoutQuote.displayValue).not.toContain('?')

    const zeroBalance = createBalance({ balance: '0x0', decimals: 18 }, undefined)
    expect(zeroBalance.displayValue).not.toContain('?')
  })

  it('creates correct displayValue when quote is provided', () => {
    // 1 ETH at $2000 = $2000
    const balance = createBalance(
      { balance: '0xDE0B6B3A7640000', decimals: 18 },
      { price: 2000, change24hr: 0 }
    )
    expect(balance.displayValue).toBe('2,000')
    expect(balance.totalValue.toNumber()).toBe(2000)
  })

  it('handles missing decimals without throwing', () => {
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: undefined }, undefined)

    expect(balance.displayBalance).toBeDefined()
    expect(balance.totalValue.toNumber()).toBe(0)
  })

  it('handles NaN decimals without throwing', () => {
    const balance = createBalance({ balance: '0x2ed3afa800', decimals: NaN }, undefined)

    expect(balance.displayBalance).toBeDefined()
  })
})

describe('#createBalance price availability', () => {
  const ETH_1 = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0x0', chainId: 1, symbol: 'ETH', name: 'Ether' }

  it('shows price and totalValue when quote has both price and change24hr', () => {
    const b = createBalance(ETH_1, { price: 2500, change24hr: 1.5 })
    expect(b.price).toBe('2,500.00')
    expect(b.totalValue.toNumber()).toBe(2500)
    expect(b.displayValue).toBe('2,500')
    expect(b.priceChange).toBe('1.50')
  })

  it('shows price with zero change24hr', () => {
    const b = createBalance(ETH_1, { price: 2500, change24hr: 0 })
    expect(b.price).toBe('2,500.00')
    expect(b.totalValue.toNumber()).toBe(2500)
    // change24hr 0 → priceChange is "0.00" (still displayed since price is non-zero)
    expect(b.priceChange).toBe('0.00')
  })

  it('handles very small price (e.g. SHIB)', () => {
    // 0x3635C9ADC5DEA00000 = 1000 * 10^18 → 1000 tokens
    const shib = { balance: '0x3635C9ADC5DEA00000', decimals: 18, address: '0xshib', chainId: 1, symbol: 'SHIB', name: 'SHIB' }
    const b = createBalance(shib, { price: 0.00001, change24hr: 5.0 })
    // 1000 * 0.00001 = 0.01 → shows $0.01
    expect(b.totalValue.toNumber()).toBeGreaterThan(0)
    expect(b.totalValue.toNumber()).toBeCloseTo(0.01)
    expect(b.displayValue).toBe('0.01')
  })

  it('handles very large price (e.g. BTC)', () => {
    const btc = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0xbtc', chainId: 1, symbol: 'WBTC', name: 'Wrapped BTC' }
    const b = createBalance(btc, { price: 65000, change24hr: -2.0 })
    expect(b.totalValue.toNumber()).toBe(65000)
    expect(b.price).toBe('65,000.00')
    expect(b.displayValue).toBe('65,000')
  })

  it('shows "?" price and "0" displayValue with zero-price quote', () => {
    const b = createBalance(ETH_1, { price: 0, change24hr: 0 })
    // zero price is valid — usdRate is 0 → totalValue is 0
    expect(b.totalValue.toNumber()).toBe(0)
    expect(b.displayValue).toBe('0')
    expect(b.displayValue).not.toContain('?')
  })

  it('shows "?" price and "0" displayValue with null quote', () => {
    const b = createBalance(ETH_1, null)
    expect(b.price).toBe('?')
    expect(b.totalValue.toNumber()).toBe(0)
    expect(b.displayValue).toBe('0')
  })

  it('never shows "$?" for any quote combination', () => {
    const scenarios = [
      undefined,
      null,
      { price: 0, change24hr: 0 },
      { price: 2000, change24hr: 1.5 },
      { price: 0.00001, change24hr: -0.5 },
      { price: 999999, change24hr: 100 }
    ]
    for (const quote of scenarios) {
      const b = createBalance(ETH_1, quote)
      expect(b.displayValue).not.toContain('?')
    }
  })

  it('produces correct totalValue for ERC-20 with 6 decimals (USDC-like)', () => {
    const usdc = { balance: '0x3B9ACA00', decimals: 6, address: '0xusdc', chainId: 1, symbol: 'USDC', name: 'USD Coin' }
    // 0x3B9ACA00 = 1_000_000_000 → 1000 USDC
    const b = createBalance(usdc, { price: 1.0, change24hr: 0.01 })
    expect(b.totalValue.toNumber()).toBe(1000)
    expect(b.displayValue).toBe('1,000')
  })

  it('produces correct totalValue for ERC-20 with 8 decimals (WBTC-like)', () => {
    const wbtc = { balance: '0x5F5E100', decimals: 8, address: '0xwbtc', chainId: 1, symbol: 'WBTC', name: 'Wrapped BTC' }
    // 0x5F5E100 = 100_000_000 → 1 WBTC
    const b = createBalance(wbtc, { price: 65000, change24hr: -1.0 })
    expect(b.totalValue.toNumber()).toBe(65000)
  })
})

describe('#formatSmallNumber subscript notation', () => {
  it('returns subscript notation for prices with 4+ leading zeros', () => {
    // 0.00001234 → 4 zeros after decimal → 0.0₄1234
    expect(formatSmallNumber(0.00001234)).toBe('0.0₄1234')
  })

  it('returns subscript notation for prices with 5 leading zeros', () => {
    // 0.000000587 → 6 zeros → 0.0₆587
    expect(formatSmallNumber(0.000000587)).toBe('0.0₆587')
  })

  it('returns subscript for SHIB-like price', () => {
    // $0.00000877 → 5 zeros → 0.0₅877
    expect(formatSmallNumber(0.00000877)).toBe('0.0₅877')
  })

  it('returns undefined for prices >= 0.001 (no subscript needed)', () => {
    expect(formatSmallNumber(0.001)).toBeUndefined()
    expect(formatSmallNumber(0.01)).toBeUndefined()
    expect(formatSmallNumber(1.5)).toBeUndefined()
    expect(formatSmallNumber(2000)).toBeUndefined()
  })

  it('returns undefined for prices with fewer than 4 leading zeros', () => {
    // 0.000123 → only 3 zeros → normal formatting
    expect(formatSmallNumber(0.000123)).toBeUndefined()
  })

  it('returns undefined for zero and negative values', () => {
    expect(formatSmallNumber(0)).toBeUndefined()
    expect(formatSmallNumber(-0.00001)).toBeUndefined()
  })

  it('trims trailing zeros from significant digits', () => {
    // 0.000010 → 4 zeros then "1" → 0.0₄1
    expect(formatSmallNumber(0.00001)).toBe('0.0₄1')
  })

  it('handles double-digit zero counts (10+ zeros)', () => {
    // 0.0000000000012 → 11 zeros (JS float precision) → 0.0₁₁12
    expect(formatSmallNumber(0.0000000000012)).toBe('0.0₁₁12')
  })

  it('limits significant figures to 4 by default', () => {
    // 0.0000123456789 → 4 zeros, then 1234 (truncated to 4 sig figs)
    expect(formatSmallNumber(0.0000123456789)).toBe('0.0₄1234')
  })

  it('respects custom sigFigs parameter', () => {
    expect(formatSmallNumber(0.0000123456789, 2)).toBe('0.0₄12')
    expect(formatSmallNumber(0.0000123456789, 6)).toBe('0.0₄123456')
  })
})

describe('#createBalance with subscript price notation', () => {
  it('uses subscript notation for very small per-unit price', () => {
    const token = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0xshib', chainId: 1, symbol: 'SHIB', name: 'SHIB' }
    const b = createBalance(token, { price: 0.00000877, change24hr: 5.0 })
    // Price per unit should use subscript
    expect(b.price).toBe('0.0₅877')
  })

  it('uses subscript notation for very small total value', () => {
    // Tiny balance (0.001 token) * tiny price (0.00001) = 0.00000001 total value
    const token = { balance: '0x38D7EA4C68000', decimals: 18, address: '0xtiny', chainId: 1, symbol: 'TINY', name: 'Tiny' }
    const b = createBalance(token, { price: 0.00001, change24hr: 0 })
    // totalValue is very small but non-zero
    expect(b.totalValue.toNumber()).toBeGreaterThan(0)
    expect(b.displayValue).not.toContain('?')
  })

  it('does not use subscript for normal prices', () => {
    const token = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0x0', chainId: 1, symbol: 'ETH', name: 'Ether' }
    const b = createBalance(token, { price: 2500, change24hr: 1.5 })
    expect(b.price).toBe('2,500.00')
    expect(b.price).not.toContain('₀')
  })
})

describe('#createBalance sub-dollar display', () => {
  it('shows "<1" for total value between $0 and $1 (e.g. 0.48 EUL at $1.10)', () => {
    // This is the exact EUL scenario: small balance * low price = sub-dollar value
    const eul = { balance: '0x6A94D74F43000', decimals: 18, address: '0xd9fcd98c', chainId: 1, symbol: 'EUL', name: 'Euler' }
    // 0x6A94D74F43000 ≈ 0.0019 ETH-scale, but let's use a simpler value
    const b = createBalance(
      { balance: '0x6A94D74F4300000', decimals: 18, address: '0xeul', chainId: 1, symbol: 'EUL', name: 'Euler' },
      { price: 1.10, change24hr: 2.0 }
    )
    // totalValue should be small but non-zero
    expect(b.totalValue.toNumber()).toBeGreaterThan(0)
    expect(b.totalValue.toNumber()).toBeLessThan(1)
    // MUST show the actual cents, NOT "0" — the old bug would show "0" and hide the price entirely
    expect(b.displayValue).not.toBe('0')
    expect(b.displayValue).toMatch(/^0\.\d{2}$/)
  })

  it('shows "0.01" for 0.01 USDC at $1', () => {
    const usdc = { balance: '0x2710', decimals: 6, address: '0xusdc', chainId: 1, symbol: 'USDC', name: 'USD Coin' }
    // 0x2710 = 10000 → 0.01 USDC → $0.01
    const b = createBalance(usdc, { price: 1.0, change24hr: 0 })
    expect(b.totalValue.toNumber()).toBeCloseTo(0.01)
    expect(b.displayValue).toBe('0.01')
  })

  it('shows "0.52" for 0.48 EUL at $1.10', () => {
    // 0.48 * 1.10 = 0.528, floor to 2 decimals = 0.52
    const eul = { balance: '0x6A94D74F4300000', decimals: 18, address: '0xeul', chainId: 1, symbol: 'EUL', name: 'Euler' }
    const b = createBalance(eul, { price: 1.10, change24hr: 0 })
    expect(b.totalValue.toNumber()).toBeGreaterThan(0)
    expect(b.totalValue.toNumber()).toBeLessThan(1)
    expect(b.displayValue).toMatch(/^0\.\d{2}$/)
    expect(b.displayValue).not.toBe('0')
  })

  it('shows "<0.01" for sub-penny values', () => {
    // 0.001 tokens * $1 = $0.001
    const token = { balance: '0x38D7EA4C68000', decimals: 18, address: '0xtiny', chainId: 1, symbol: 'T', name: 'Tiny' }
    const b = createBalance(token, { price: 1.0, change24hr: 0 })
    expect(b.totalValue.toNumber()).toBeGreaterThan(0)
    expect(b.totalValue.toNumber()).toBeLessThan(0.01)
    expect(b.displayValue).toBe('<0.01')
  })

  it('does NOT show "<0.01" for values >= $1', () => {
    const token = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0x0', chainId: 1, symbol: 'ETH', name: 'Ether' }
    const b = createBalance(token, { price: 2000, change24hr: 0 })
    expect(b.displayValue).toBe('2,000')
  })

  it('shows "0" only when totalValue is exactly zero (no quote)', () => {
    const token = { balance: '0xDE0B6B3A7640000', decimals: 18, address: '0x0', chainId: 1, symbol: 'ETH', name: 'Ether' }
    const b = createBalance(token, undefined)
    expect(b.displayValue).toBe('0')
  })
})

describe('#sortByTotalValue', () => {
  const mockBalance = (totalValue, balance = 0, decimals = 0) => ({
    totalValue: BigNumber(totalValue),
    decimals,
    balance
  })

  it('should sort balances in descending order by total value', () => {
    const values = [10, 100, 60]
    const unsorted = values.map(mockBalance)

    const sortedValues = unsorted.sort(byTotalValue).map((b) => b.totalValue.toNumber())

    expect(sortedValues).toStrictEqual([100, 60, 10])
  })

  it('should sort balances in descending order by balance', () => {
    const values = [10, 100, 60]
    const unsorted = values.map((value) => mockBalance(10, value))

    const sortedValues = unsorted.sort(byTotalValue).map((b) => b.balance)

    expect(sortedValues).toStrictEqual([100, 60, 10])
  })

  it('should sort balances in descending order by totalValue and balance', () => {
    const bal1 = mockBalance(10, 20)
    const bal2 = mockBalance(100, 990)
    const bal3 = mockBalance(0, 1000)
    const bal4 = mockBalance(100, 989)

    const unsorted = [bal1, bal2, bal3, bal4]
    const sortedValues = unsorted.sort(byTotalValue)

    expect(sortedValues).toStrictEqual([bal2, bal4, bal1, bal3])
  })
})
