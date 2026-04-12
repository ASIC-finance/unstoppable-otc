import { useEffect, useState } from 'react'
import { ensureTokenListLoaded, getTokenLogoCache } from '../config/tokenlist'

export function useTokenLogo(address: `0x${string}` | undefined): string | undefined {
  const cachedLogo = address
    ? getTokenLogoCache()?.get(address.toLowerCase())
    : undefined
  const [resolvedLogo, setResolvedLogo] = useState<{
    address?: `0x${string}`
    logo?: string
  }>({})

  useEffect(() => {
    if (!address || cachedLogo) {
      return
    }

    let cancelled = false

    ensureTokenListLoaded().then((map) => {
      if (!cancelled) {
        setResolvedLogo({
          address,
          logo: map.get(address.toLowerCase()),
        })
      }
    })

    return () => { cancelled = true }
  }, [address, cachedLogo])

  if (!address) {
    return undefined
  }

  return cachedLogo ?? (resolvedLogo.address === address ? resolvedLogo.logo : undefined)
}
