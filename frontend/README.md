# Unstoppable OTC — Frontend

Self-custodial React interface for creating, browsing, and settling OTC token
orders against the `OTCFactory` / `OTCPair` contracts.

## Stack

- **React 19** + **TypeScript** + **Vite** + **Tailwind CSS v4**
- **wagmi v3** + **viem v2** for chain I/O
- **@reown/appkit** for wallet connection (WalletConnect v2 under the hood)
- **@tanstack/react-query** for caching
- **Vitest** + **@testing-library/react** for tests

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # Production bundle (tsc -b && vite build)
npm run lint      # ESLint
npm run test      # Vitest — headless
npm run test:watch
npm run test:ui   # Interactive test UI
```

## Environment

Create a `.env` file:

```
VITE_REOWN_PROJECT_ID=<your-project-id>
```

A project ID is free at https://cloud.reown.com — the app throws on startup if
it's missing.

## Directory layout

```
src/
  abi/               # Typed contract ABIs (as const)
  components/        # Presentational + layout components
    create-order/    # CreateOrder wizard subcomponents
  config/            # Chain definitions, AppKit / token-list wiring
  hooks/             # Data / tx hooks (see useTx below)
  lib/               # Framework-agnostic runtime utilities
  pages/             # Route-level components (lazy-loaded)
  test/              # Vitest setup
  types/             # Shared type declarations
  utils/             # Pure helpers (format, validation, address)
```

## Architecture

See [`CLAUDE.md`](../CLAUDE.md) in the repo root for the patterns this codebase
follows, including:

- The `useTx` transaction lifecycle abstraction
- The toast system
- Multicall-first RPC reads
- Error translation flow
