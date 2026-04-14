import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import { ensureTokenListLoaded, getTokenLogoURI } from '../config/tokenlist'

/**
 * Returns the logoURI for a token on the currently-connected chain, or
 * undefined if the token isn't in the cached list.
 *
 * Cache keys are `${chainId}:${address.toLowerCase()}` — the same address
 * on two chains doesn't collide.
 */
export function useTokenLogo(address: `0x${string}` | undefined): string | undefined {
  const chainId = useChainId()
  const cachedLogo = getTokenLogoURI(chainId, address)

  const [resolved, setResolved] = useState<{ key: string; logo?: string }>({ key: '' })

  useEffect(() => {
    if (!address || cachedLogo) return

    let cancelled = false
    const key = `${chainId}:${address.toLowerCase()}`

    ensureTokenListLoaded().then(() => {
      if (!cancelled) {
        setResolved({ key, logo: getTokenLogoURI(chainId, address) })
      }
    })

    return () => { cancelled = true }
  }, [address, cachedLogo, chainId])

  if (!address) return undefined

  const key = `${chainId}:${address.toLowerCase()}`
  return cachedLogo ?? (resolved.key === key ? resolved.logo : undefined)
}
