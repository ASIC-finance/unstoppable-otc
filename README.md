# Unstoppable OTC

Decentralized OTC trading platform for ERC20 tokens. Zero fees. No admin keys. No upgradability. Fully on-chain.

## Architecture

Uniswap-style factory/pair isolation. Each token pair gets its own contract with its own storage and token balances. A malicious token can only affect its own pair.

```
OTCFactory (deploys pairs, maintains registry)
  |
  +-- OTCPair(USDC, WETH)     -- isolated order book + escrow
  +-- OTCPair(DAI, WBTC)      -- completely separate contract
  +-- OTCPair(X, USDC)        -- if X is malicious, only this pair is affected
```

### Contracts

| Contract | Lines | Description |
|----------|-------|-------------|
| `OTCFactory.sol` | 66 | Deploys `OTCPair` contracts via CREATE2. Tracks all pairs. Sorts tokens (token0 < token1). |
| `OTCPair.sol` | 247 | Order book + escrow for one token pair. Supports partial fills, cancel with refund, on-chain indices. |

### How it works

1. **Create pair** -- Anyone calls `factory.createPair(tokenA, tokenB)`. Deploys an isolated `OTCPair`.
2. **Create order** -- Maker approves + calls `pair.createOrder(sellToken0, sellAmount, buyAmount)`. Tokens are escrowed in the pair contract.
3. **Fill order** -- Taker approves + calls `pair.fillOrder(orderId, sellAmountOut)`. Atomic swap: buy tokens go to maker, sell tokens go to taker. Supports partial fills.
4. **Cancel order** -- Only the maker can cancel. Unfilled tokens are refunded.

### Security design

- **Pair isolation** -- Each pair is a separate contract. No shared token balances across pairs.
- **ReentrancyGuard** -- On all three mutating functions (`createOrder`, `fillOrder`, `cancelOrder`).
- **SafeERC20** -- Handles non-standard tokens (no return value, e.g. USDT).
- **Fee-on-transfer support** -- Balance-before/after pattern records actual received amounts.
- **Ceil-div rounding** -- `buyAmountIn` rounds UP to protect maker's posted price. Taker never pays less than the proportional rate.
- **Checks-effects-interactions** -- State updates before external calls.
- **No admin, no owner, no pause, no proxy** -- Immutable bytecode. No one can change the rules.
- **On-chain indices** -- `getActiveOrders()` and `getMakerOrders()` with pagination. No external indexer needed.

## Project structure

```
unstoppable-otc/
  contracts/                    # Hardhat (Solidity 0.8.28, OpenZeppelin v5)
    contracts/
      OTCFactory.sol
      OTCPair.sol
      mocks/                    # MockERC20, MockFeeToken (testing only)
    test/OTCSwap.test.ts        # 23 tests
    ignition/modules/           # Deployment script
  frontend/                     # Vite + React + TypeScript
    src/
      config/                   # Multi-chain config, Reown AppKit setup
      abi/                      # Typed ABIs (Factory + Pair)
      hooks/                    # useFactory, useOrders, useCreateOrder, useFillOrder, ...
      components/               # Layout, OrderTable, TokenBadge (with logo support)
      pages/                    # OrderBook, CreateOrder, MyOrders
  .github/workflows/ci.yml     # GitHub Actions: compile, test, type-check, build
  docker-compose.yml            # Hardhat node + frontend dev server
```

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Frontend

Get a Reown project ID at [cloud.reown.com](https://cloud.reown.com), then:

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env and add your VITE_REOWN_PROJECT_ID
npm run dev
```

### Docker

```bash
# Start local Hardhat node + frontend
docker compose up
```

### Deploy to testnet

```bash
cd contracts
npx hardhat ignition deploy ignition/modules/OTCSwap.ts --network sepolia
```

Then update `frontend/src/config/chains.ts` with the deployed factory address.

## Adding a new chain

1. Deploy `OTCFactory` to the new chain.
2. Add an entry to `supportedChains` in `frontend/src/config/chains.ts`:

```ts
{
  network: myChain,
  factoryAddress: '0x...',
}
```

No other code changes needed.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Smart contracts | Solidity 0.8.28, OpenZeppelin v5, Hardhat |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Wallet connection | Reown AppKit v2 (wagmi + viem) |
| CI | GitHub Actions |
| Dev environment | Docker Compose |

## License

MIT
