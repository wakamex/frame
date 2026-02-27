import log from 'electron-log'

import type { UsdRate } from '../../provider/assets'
import type { Rate, Token } from '../../store/state'
import { NATIVE_CURRENCY } from '../../../resources/constants'

import { setNativeCurrencyData, setRates } from '../../store/actions'

const CHAIN_ID_TO_LLAMA: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
  84532: 'base',
  11155111: 'ethereum',
  11155420: 'optimism'
}

const POLL_INTERVAL = 30_000 // 30 seconds

function buildCoinId(chainId: number, address?: string): string | undefined {
  const chain = CHAIN_ID_TO_LLAMA[chainId]
  if (!chain) return undefined
  return `${chain}:${address || NATIVE_CURRENCY}`
}

export default function rates(state: any) {
  const storeApi = {
    getKnownTokens: (address?: Address) =>
      ((address && (state.main.tokens.known as any)?.[address]) || []) as Token[],
    getCustomTokens: () => (state.main.tokens.custom || []) as Token[],
    setNativeCurrencyRate: (chainId: number, rate: Rate) =>
      setNativeCurrencyData('ethereum', chainId, { usd: rate } as any),
    setTokenRates: (rates: Record<Address, UsdRate>) => setRates(rates)
  }

  let pollTimer: ReturnType<typeof setInterval> | undefined
  let currentChains: number[] = []
  let currentAddress: Address | undefined

  async function fetchRates() {
    const knownTokens = storeApi.getKnownTokens(currentAddress).filter((t) => currentChains.includes(t.chainId))
    const customTokens = storeApi
      .getCustomTokens()
      .filter((t) => !knownTokens.some((kt) => kt.address === t.address && kt.chainId === t.chainId))

    const allTokens = [...knownTokens, ...customTokens]

    // Build coin IDs for native currencies and tokens
    const nativeCoinIds = currentChains
      .map((chainId) => ({ chainId, coinId: buildCoinId(chainId) }))
      .filter((e): e is { chainId: number; coinId: string } => !!e.coinId)

    const tokenCoinIds = allTokens
      .map((t) => ({ address: t.address, chainId: t.chainId, coinId: buildCoinId(t.chainId, t.address) }))
      .filter((e): e is { address: string; chainId: number; coinId: string } => !!e.coinId)

    const allCoinIds = [...nativeCoinIds.map((n) => n.coinId), ...tokenCoinIds.map((t) => t.coinId)]

    if (allCoinIds.length === 0) return

    const coinIdsParam = allCoinIds.join(',')

    try {
      const [pricesRes, changeRes] = await Promise.all([
        fetch(`https://coins.llama.fi/prices/current/${coinIdsParam}`),
        fetch(`https://coins.llama.fi/percentage/${coinIdsParam}`)
      ])

      if (!pricesRes.ok || !changeRes.ok) {
        log.warn('DefiLlama rate fetch failed', { prices: pricesRes.status, change: changeRes.status })
        return
      }

      const pricesData = (await pricesRes.json()) as { coins: Record<string, { price: number }> }
      const changeData = (await changeRes.json()) as { coins: Record<string, number> }

      // Update native currency rates
      for (const { chainId, coinId } of nativeCoinIds) {
        const price = pricesData.coins[coinId]?.price
        if (price !== undefined) {
          storeApi.setNativeCurrencyRate(chainId, {
            price,
            change24hr: changeData.coins[coinId] ?? 0
          })
        }
      }

      // Update token rates
      if (tokenCoinIds.length > 0) {
        const tokenRates: Record<string, UsdRate> = {}

        for (const { address, coinId } of tokenCoinIds) {
          const price = pricesData.coins[coinId]?.price
          if (price !== undefined) {
            tokenRates[address] = {
              usd: {
                price,
                change24hr: changeData.coins[coinId] ?? 0
              }
            }
          }
        }

        if (Object.keys(tokenRates).length > 0) {
          storeApi.setTokenRates(tokenRates)
        }
      }

      log.debug(
        `updated rates for ${nativeCoinIds.length} native currencies and ${tokenCoinIds.length} tokens`
      )
    } catch (err) {
      log.warn('DefiLlama rate fetch error', err)
    }
  }

  function updateSubscription(chains: number[], address?: Address) {
    currentChains = chains
    currentAddress = address

    // Fetch immediately on subscription change
    fetchRates()
  }

  function start() {
    log.verbose('starting DefiLlama rate polling')

    pollTimer = setInterval(fetchRates, POLL_INTERVAL)
  }

  function stop() {
    log.verbose('stopping DefiLlama rate polling')

    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  return {
    start,
    stop,
    updateSubscription
  }
}
