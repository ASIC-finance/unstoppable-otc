import type { Address } from 'viem'

/**
 * Tokens pinned to the top of the TokenPicker on each chain, in display
 * order. These are the tokens users will look for most often — stablecoins,
 * wrapped natives, blue-chip assets.
 *
 * Addresses are stored lowercase; the picker compares case-insensitively.
 */
export const PINNED_TOKENS: Record<number, Address[]> = {
  // Ethereum mainnet
  1: [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  ],
  // PulseChain
  369: [
    '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
    '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI (bridged)
    '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC (bridged)
    '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // USDT (bridged)
  ],
}
