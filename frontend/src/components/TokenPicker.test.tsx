import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TokenEntry } from '../config/tokenlist'

const weth: TokenEntry = {
  chainId: 1, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18,
  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  logoURI: 'https://example.com/weth.png',
}
const usdc: TokenEntry = {
  chainId: 1, symbol: 'USDC', name: 'USD Coin', decimals: 6,
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  logoURI: 'https://example.com/usdc.png',
}
const dai: TokenEntry = {
  chainId: 1, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18,
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  logoURI: 'https://example.com/dai.png',
}

vi.mock('../hooks/useTokens', () => ({
  useTokens: () => ({
    chainId: 1,
    tokens: [weth, usdc, dai],
    pinned: [weth, usdc],
    isLoading: false,
  }),
}))

// Configurable fake — tests can override per-call. Returns "no metadata" by
// default so the picker shows its loading/custom states; the on-chain
// custom-token test sets a richer return value.
const tokenInfoMock = vi.fn(() => ({
  name: undefined as string | undefined,
  symbol: undefined as string | undefined,
  decimals: undefined as number | undefined,
  isLoading: false,
  isError: false,
}))

vi.mock('../hooks/useTokenInfo', () => ({
  useTokenInfo: (...args: unknown[]) => tokenInfoMock(...(args as [])),
}))

vi.mock('../config/tokenlist', async () => {
  const actual = await vi.importActual<typeof import('../config/tokenlist')>('../config/tokenlist')
  return {
    ...actual,
    getTokenEntry: (_chainId: number, address: string | undefined) => {
      if (!address) return undefined
      const lower = address.toLowerCase()
      return [weth, usdc, dai].find(t => t.address === lower)
    },
  }
})

import { TokenPicker } from './TokenPicker'

function Harness({ initial = '', exclude }: { initial?: string; exclude?: string }) {
  return (
    <TokenPicker
      label="Sell Token"
      value={initial}
      onChange={() => {}}
      excludeAddress={exclude}
    />
  )
}

describe('TokenPicker', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    tokenInfoMock.mockReturnValue({
      name: undefined,
      symbol: undefined,
      decimals: undefined,
      isLoading: false,
      isError: false,
    })
  })

  it('renders a "Select token" placeholder when value is empty', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /sell token/i })).toBeInTheDocument()
    expect(screen.getByText('Select token')).toBeInTheDocument()
  })

  it('renders the selected token symbol when value is set', () => {
    render(<Harness initial={weth.address} />)
    expect(screen.getByText('WETH')).toBeInTheDocument()
    expect(screen.getByText('Wrapped Ether')).toBeInTheDocument()
  })

  it('opens a listbox with pinned tokens at the top', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const listbox = await screen.findByRole('listbox', { name: /sell token/i })
    const options = within(listbox).getAllByRole('option')
    const symbols = options.map(o => o.querySelector('.picker-option-symbol')?.textContent)
    expect(symbols.indexOf('WETH')).toBeLessThan(symbols.indexOf('DAI'))
    expect(symbols.indexOf('USDC')).toBeLessThan(symbols.indexOf('DAI'))
  })

  it('filters the list by symbol', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const search = await screen.findByRole('combobox')
    await user.type(search, 'usd')

    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(within(listbox).getByText('USDC')).toBeInTheDocument()
  })

  it('selects a token when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TokenPicker label="Sell Token" value="" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const listbox = await screen.findByRole('listbox')
    const usdcOption = within(listbox).getByText('USDC').closest('[role="option"]')!
    await user.click(usdcOption)

    expect(onChange).toHaveBeenCalledWith(usdc.address)
  })

  it('excludes the excludeAddress from the list', async () => {
    const user = userEvent.setup()
    render(<Harness exclude={weth.address} />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).queryByText('WETH')).not.toBeInTheDocument()
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const button = screen.getByRole('button', { name: /sell token/i })
    await user.click(button)

    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects the highlighted option on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TokenPicker label="Sell Token" value="" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(weth.address)
  })

  it('moves highlight with ArrowDown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TokenPicker label="Sell Token" value="" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith(usdc.address)
  })

  it('shows on-chain symbol/name for a pasted custom address (not "Custom token")', async () => {
    const user = userEvent.setup()
    tokenInfoMock.mockReturnValue({
      name: 'Some Random Token',
      symbol: 'SRT',
      decimals: 18,
      isLoading: false,
      isError: false,
    })

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const search = await screen.findByRole('combobox')
    const customAddr = '0x1111111111111111111111111111111111111111'
    await user.type(search, customAddr)

    // The synthetic option should display the on-chain metadata, not "Custom".
    expect(screen.getByText('SRT')).toBeInTheDocument()
    expect(screen.getByText('Some Random Token')).toBeInTheDocument()
    expect(screen.queryByText('Custom token')).not.toBeInTheDocument()
  })

  it('falls back to "Loading…" while on-chain metadata is in flight', async () => {
    const user = userEvent.setup()
    tokenInfoMock.mockReturnValue({
      name: undefined,
      symbol: undefined,
      decimals: undefined,
      isLoading: true,
      isError: false,
    })

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const search = await screen.findByRole('combobox')
    await user.type(search, '0x1111111111111111111111111111111111111111')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('falls back to "Custom token" when the on-chain read errors out', async () => {
    const user = userEvent.setup()
    tokenInfoMock.mockReturnValue({
      name: undefined,
      symbol: undefined,
      decimals: undefined,
      isLoading: false,
      isError: true,
    })

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /sell token/i }))

    const search = await screen.findByRole('combobox')
    await user.type(search, '0x1111111111111111111111111111111111111111')

    expect(screen.getByText('Custom token')).toBeInTheDocument()
  })

  it('shows on-chain symbol/name in the closed-state button for a custom selected address', () => {
    tokenInfoMock.mockReturnValue({
      name: 'Some Random Token',
      symbol: 'SRT',
      decimals: 18,
      isLoading: false,
      isError: false,
    })

    render(<Harness initial="0x1111111111111111111111111111111111111111" />)
    expect(screen.getByText('SRT')).toBeInTheDocument()
    expect(screen.getByText('Some Random Token')).toBeInTheDocument()
  })
})
