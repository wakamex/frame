import BigNumber from 'bignumber.js'

import { NATIVE_CURRENCY } from '../../constants'

import type { WithTokenId, Balance, Rate } from '../../../main/store/state'

interface DisplayedBalance extends Balance {
  displayBalance: string
  price: string
  priceChange: string | false
  usdRate: Rate
  totalValue: BigNumber
  displayValue: string
}

const UNKNOWN = '?'
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const MIN_ZEROS_FOR_SUBSCRIPT = 4

export function formatSmallNumber(value: number, sigFigs = 4): string | undefined {
  if (value <= 0 || value >= 0.001) return undefined

  const str = value.toFixed(20)
  const afterDecimal = str.split('.')[1] || ''

  let zeroCount = 0
  for (const ch of afterDecimal) {
    if (ch === '0') zeroCount++
    else break
  }

  if (zeroCount < MIN_ZEROS_FOR_SUBSCRIPT) return undefined

  const significant = afterDecimal.slice(zeroCount, zeroCount + sigFigs).replace(/0+$/, '')
  const subscript = String(zeroCount)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[parseInt(d)])
    .join('')

  return `0.0${subscript}${significant}`
}

export function formatBalance(balance: BigNumber, totalValue: BigNumber, decimals = 8) {
  const isZero = balance.isZero()
  if (!isZero && balance.toNumber() < 0.001 && totalValue.toNumber() < 1) return '<0.001'

  return new Intl.NumberFormat('us-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  }).format(Number(balance.toFixed(decimals, BigNumber.ROUND_FLOOR)))
}

export function formatUsdRate(rate: BigNumber, decimals = 2) {
  if (rate.isNaN()) return UNKNOWN

  const num = rate.toNumber()
  const small = formatSmallNumber(num)
  if (small) return small

  return new Intl.NumberFormat('us-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(rate.toFixed(decimals, BigNumber.ROUND_FLOOR)))
}

export function createBalance(rawBalance: Balance, quote?: Rate): DisplayedBalance {
  const decimals = Number.isFinite(rawBalance.decimals) ? rawBalance.decimals : 18
  const balance = BigNumber(rawBalance.balance || 0).shiftedBy(-decimals)
  const usdRate = new BigNumber((quote && quote.price) || NaN)
  const change24hr = new BigNumber((quote && quote['change24hr']) || 0)

  const totalValue = balance.times(usdRate)
  const balanceDecimals = Math.max(2, usdRate.shiftedBy(1).toFixed(0, BigNumber.ROUND_DOWN).length)

  const safeTotalValue = totalValue.isNaN() ? BigNumber(0) : totalValue

  return {
    ...rawBalance,
    usdRate: quote as Rate,
    displayBalance: formatBalance(balance, safeTotalValue, balanceDecimals),
    price: formatUsdRate(usdRate),
    priceChange: !usdRate.isZero() && !usdRate.isNaN() && change24hr.toFixed(2),
    totalValue: safeTotalValue,
    displayValue: safeTotalValue.isZero()
      ? '0'
      : safeTotalValue.lt(0.01) && safeTotalValue.gt(0)
        ? '<0.01'
        : formatUsdRate(safeTotalValue, safeTotalValue.lt(1) ? 2 : 0)
  }
}

export const sortByTotalValue = (a: DisplayedBalance, b: DisplayedBalance) => {
  const difference = b.totalValue.minus(a.totalValue)
  if (!difference.isZero()) {
    return difference
  }
  const balanceA = BigNumber(a.balance || 0).shiftedBy(-(Number.isFinite(a.decimals) ? a.decimals : 0))
  const balanceB = BigNumber(b.balance || 0).shiftedBy(-(Number.isFinite(b.decimals) ? b.decimals : 0))

  return balanceB.minus(balanceA)
}

export function isNativeCurrency(address: string) {
  return address === NATIVE_CURRENCY
}

export function toTokenId(token: WithTokenId) {
  const { chainId, address } = token
  return `${chainId}:${address.toLowerCase()}`
}
