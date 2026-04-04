import { useEffect, useState } from 'react'
import { ensureTokenListLoaded, getTokenLogoCache } from '../config/tokenlist'

export function useTokenLogo(address: `0x${string}` | undefined): string | undefined {
  const [logo, setLogo] = useState<string | undefined>(() => {
    if (!address) return undefined
    return getTokenLogoCache()?.get(address.toLowerCase())
  })

  useEffect(() => {
    if (!address) return
    const cached = getTokenLogoCache()?.get(address.toLowerCase())
    if (cached) {
      setLogo(cached)
      return
    }
    let cancelled = false
    ensureTokenListLoaded().then((map) => {
      if (!cancelled) {
        setLogo(map.get(address.toLowerCase()))
      }
    })
    return () => { cancelled = true }
  }, [address])

  return logo
}
