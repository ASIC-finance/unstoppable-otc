import { useChainId, useSwitchChain, useAccount } from 'wagmi'
import { getSupportedChain, supportedChains, getFactoryAddress } from '../config/chains'

/**
 * Renders a sticky banner when the user is connected to a chain we don't
 * support OR we support but don't yet have a factory deployed on.
 */
export function WrongChainBanner() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected) return null

  const current = getSupportedChain(chainId)
  const factory = getFactoryAddress(chainId)

  if (current && factory) return null

  const candidates = supportedChains.filter(c => getFactoryAddress(Number(c.network.id)))
  const fallbackTargets = candidates.length > 0 ? candidates : supportedChains

  const heading = current
    ? `${current.network.name} has no factory deployed yet`
    : 'Unsupported network'

  const copy = current
    ? 'OTC contracts have not been deployed on this chain. Switch to a supported network to create or fill orders.'
    : 'Unstoppable OTC supports Ethereum and PulseChain. Switch your wallet to continue.'

  return (
    <div role="alert" className="chain-banner">
      <div className="chain-banner-body">
        <strong>{heading}</strong>
        <p className="m-0 text-sm">{copy}</p>
      </div>
      <div className="chain-banner-actions">
        {fallbackTargets.map(c => (
          <button
            key={c.network.id}
            type="button"
            onClick={() => switchChain({ chainId: c.network.id as number })}
            disabled={isPending || c.network.id === chainId}
            className="secondary-button min-h-0 px-3 py-2 text-sm"
          >
            {isPending ? 'Switching…' : `Switch to ${c.network.name}`}
          </button>
        ))}
      </div>
    </div>
  )
}
