const TOKENLIST_URL =
  'https://raw.githubusercontent.com/piteasio/app-tokens/refs/heads/main/piteas-tokenlist.json'

type TokenEntry = {
  chainId: number
  name: string
  address: string
  symbol: string
  decimals: number
  logoURI: string
}

type TokenList = {
  name: string
  tokens: TokenEntry[]
}

// Global cache: lowercase address → logoURI
let logoCache: Map<string, string> | null = null
let fetchPromise: Promise<Map<string, string>> | null = null

async function fetchTokenList(): Promise<Map<string, string>> {
  const res = await fetch(TOKENLIST_URL)
  const data: TokenList = await res.json()
  const map = new Map<string, string>()
  for (const token of data.tokens) {
    map.set(token.address.toLowerCase(), token.logoURI)
  }
  return map
}

export function getTokenLogoCache(): Map<string, string> | null {
  return logoCache
}

export function ensureTokenListLoaded(): Promise<Map<string, string>> {
  if (logoCache) return Promise.resolve(logoCache)
  if (!fetchPromise) {
    fetchPromise = fetchTokenList()
      .then((map) => {
        logoCache = map
        return map
      })
      .catch(() => {
        fetchPromise = null
        return new Map<string, string>()
      })
  }
  return fetchPromise
}
