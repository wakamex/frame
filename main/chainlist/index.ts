let cache: { data: any[]; fetchedAt: number } | null = null
const CACHE_TTL = 3600000 // 1 hour

export async function getChainlist(): Promise<any[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data
  const res = await fetch('https://chainid.network/chains.json')
  const data = await res.json()
  cache = { data, fetchedAt: Date.now() }
  return data
}
